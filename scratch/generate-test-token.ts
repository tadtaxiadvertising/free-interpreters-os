import { prisma } from "../src/lib/prisma";
import crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

async function generateTestToken() {
  const email = "admin@freeinterpreters.com";
  
  try {
    console.log(`🔍 Buscando usuario: ${email}...`);
    // 1. Verificar si el usuario existe
    const user = await (prisma as any).rbacUser.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ ERROR: El usuario ${email} no existe.`);
      return;
    }

    // 2. Generar Token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hora

    // 3. Guardar en DB
    await (prisma as any).passwordResetToken.create({
      data: {
        email,
        token: hashedToken,
        expires,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://database-interpreters.rewvid.easypanel.host";
    const resetLink = `${appUrl}/portal-rbac/reset-password/${rawToken}`;

    console.log("\n====================================================");
    console.log("🔥 TOKEN DE PRUEBA GENERADO EXITOSAMENTE 🔥");
    console.log("====================================================");
    console.log(`Usuario: ${email}`);
    console.log(`Enlace:  ${resetLink}`);
    console.log("====================================================\n");
  } catch (error) {
    console.error("❌ Error durante la generación del token:", error);
  }
}

generateTestToken()
  .catch(console.error)
  .finally(() => (prisma as any).$disconnect?.());
