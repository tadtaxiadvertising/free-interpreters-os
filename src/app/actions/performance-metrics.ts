"use server";

import prismaClient from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { validateAction } from "@/lib/auth/actions";
import type { ActionResult } from "@/lib/types";

// Regla de Oro 1: Nunca desconectamos Prisma. Usamos el singleton.
const prisma = prismaClient;

// Regla de Oro 4: Validación Estricta con Zod
export const UpdateMetricsSchema = z.object({
  interpreterId: z.number().positive("El ID del intérprete es requerido"),
  monthlyGoal: z.number().min(100).max(15000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido").optional(),
  interpretedMinutes: z.number().min(0, "Los minutos no pueden ser negativos").optional(),
});

/**
 * Server Action para actualizar metas y/o registrar métricas de forma segura.
 */
export async function registerPerformanceMetrics(data: unknown): Promise<ActionResult> {
  // Regla de Oro 3: Manejo de Errores Profesional (try/catch robusto)
  try {
    const auth = await validateAction(["admin", "interpreter"]);
    if ("error" in auth) {
      return { success: false, error: auth.error, code: auth.code };
    }

    const validated = UpdateMetricsSchema.parse(data);
    const { interpreterId, monthlyGoal, date, interpretedMinutes } = validated;

    // Validación de seguridad (solo admin o el propio intérprete)
    if (auth.profile.role !== "admin" && auth.profile.interpreterId !== interpreterId) {
      return { success: false, error: "No tienes permiso para actualizar este intérprete.", code: "UNAUTHORIZED" };
    }

    // Transacción de Prisma segura, sin pool.end()
    await prisma.$transaction(async (tx) => {
      // 1. Actualización de meta mensual
      if (monthlyGoal !== undefined) {
        await tx.interpreter.update({
          where: { id: interpreterId },
          data: { monthlyGoal },
        });
      }

      // 2. Registro manual de métrica diaria (combina en logs estáticos)
      if (date && interpretedMinutes !== undefined) {
        const targetDate = new Date(`${date}T12:00:00Z`);
        
        const existingLog = await tx.productionLog.findFirst({
          where: { interpreterId, date: targetDate },
        });

        if (existingLog) {
          await tx.productionLog.update({
            where: { id: existingLog.id },
            data: { interpretedMinutes },
          });
        } else {
          await tx.productionLog.create({
            data: {
              interpreterId,
              date: targetDate,
              interpretedMinutes,
              callsAttended: 0,
              status: "Completed",
              adherence: 100,
              observaciones: "Actualización de métricas de rendimiento",
            },
          });
        }
      }
    });

    revalidatePath("/dashboard");
    revalidatePath(`/interpreters/${interpreterId}`);
    
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Datos de entrada inválidos. " + error.errors[0].message, code: "VALIDATION_ERROR" };
    }
    console.error("🔴 ERROR [registerPerformanceMetrics]:", error);
    return { success: false, error: "Error interno al actualizar métricas.", code: "INTERNAL_ERROR" };
  }
}
