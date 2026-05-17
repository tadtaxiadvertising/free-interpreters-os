"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma"; // Singleton global de Prisma asignado al puerto 6543

// Esquemas de validación estrictos en tiempo de ejecución
const loginSchema = z.object({
  email: z.string().email("Formato de correo inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

const requestResetSchema = z.object({
  email: z.string().email("Formato de correo corporativo inválido"),
});

const executeResetSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "La contraseña debe contener al menos 8 caracteres")
    .regex(/^(?=.*[a-zA-Z])(?=.*[0-9])/, "Debe ser alfanumérica"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas ingresadas no coinciden",
  path: ["confirmPassword"],
});

/**
 * 1. Autenticación de Usuarios RBAC
 */
export async function loginAction(formData: FormData) {
  try {
    const rawFields = Object.fromEntries(formData.entries());
    const validated = loginSchema.parse(rawFields);

    const user = await prisma.rbacUser.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      return { error: "Credenciales de acceso inválidas" };
    }

    const isValid = await bcrypt.compare(validated.password, user.password);
    if (!isValid) {
      return { error: "Credenciales de acceso inválidas" };
    }

    // Aquí se invoca la infraestructura de sesión de Auth.js (v5)
    // Para simplificar la portabilidad directa, devolvemos el estado exitoso
    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0].message };
    }
    return { error: "Error crítico de comunicación con el portal" };
  }
}

/**
 * 2. Emisión y Registro de Tokens con Mecanismo Fallback
 */
export async function requestResetAction(formData: FormData) {
  const genericResponse = { success: true, message: "Si el correo electrónico corresponde a una cuenta activa en el sistema de roster, recibirá un enlace seguro de restablecimiento en los próximos minutos." };

  try {
    const rawFields = Object.fromEntries(formData.entries());
    const { email } = requestResetSchema.parse(rawFields);

    // Verificación de existencia real del usuario y lectura de su Rol de Seguridad
    const user = await prisma.rbacUser.findUnique({
      where: { email },
    });

    // Mitigación de enumeración de cuentas: si no existe, salimos con éxito ficticio
    if (!user) {
      return genericResponse;
    }

    // Generación de token único criptográfico
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expirationTime = new Date(Date.now() + 3600000); // Expiración exacta de 1 hora

    // Persistencia del token
    await (prisma as any).passwordResetToken.create({
      data: {
        email: user.email,
        token: hashedToken,
        expires: expirationTime,
      },
    });

    // Link de un solo uso generado dinámicamente
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.freeinterpreters.com";
    const resetLink = `${appUrl}/portal-rbac/reset-password/${rawToken}`;

    // REGISTRO ESTRUCTURADO CORPORATIVO EN CONSOLA (Auditoría e Interoperabilidad a Costo $0)
    console.log(JSON.stringify({
      event: "AUTH_PASSWORD_RESET_REQUEST",
      timestamp: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        role: user.role, // ADMIN, HOLDER, INTERPRETER
      },
      audit: {
        actionRequired: "MANUAL_DISPATCH_OR_AUDIT",
        resetLink: resetLink,
        tokenExpiresAt: expirationTime.toISOString()
      },
      infrastructure: "EASYPANEL_VPS_DOCKER_CONTAINER"
    }, null, 2));

    return genericResponse;
  } catch (err) {
    // El fallo en el proceso de background no debe comprometer la opacidad de la seguridad
    return genericResponse;
  }
}

/**
 * 3. Ejecución Transaccional de Restablecimiento por Rol
 */
export async function executeResetAction(formData: FormData) {
  try {
    const rawFields = Object.fromEntries(formData.entries());
    const validated = executeResetSchema.parse(rawFields);

    // Re-hashing del token del cliente para buscar la correspondencia en DB
    const hashedToken = crypto.createHash("sha256").update(validated.token).digest("hex");

    const tokenRecord = await (prisma as any).passwordResetToken.findUnique({
      where: { token: hashedToken },
    });

    if (!tokenRecord || tokenRecord.expires < new Date()) {
      return { error: "El token de seguridad es inválido o ha expirado" };
    }

    // Identificar el usuario para validar su existencia y registrar de forma precisa su rol antes de la mutación
    const user = await prisma.rbacUser.findUnique({
      where: { email: tokenRecord.email },
    });

    if (!user) {
      return { error: "El usuario asignado a este proceso ya no existe en el sistema" };
    }

    // Encriptación segura utilizando factor balanceado para evitar bloqueos por CPU en el VPS
    const newHashedPassword = await bcrypt.hash(validated.password, 10);

    // EJECUCIÓN TRANSACCIONAL ATÓMICA (ACID)
    await prisma.$transaction([
      // 1. Modificar la contraseña del usuario identificado
      prisma.rbacUser.update({
        where: { email: user.email },
        data: { password: newHashedPassword },
      }),
      // 2. Destruir de forma definitiva el token usado para mitigar ataques de replay
      (prisma as any).passwordResetToken.delete({
        where: { id: tokenRecord.id },
      }),
    ]);

    // Registro del éxito en logs para auditorías de cumplimiento interno
    console.log(`[SUCCESS_AUTH] Password updated successfully for user ${user.id} with Role: [${user.role}]`);

    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0].message };
    }
    return { error: "Error interno crítico al procesar la actualización de seguridad" };
  }
}
