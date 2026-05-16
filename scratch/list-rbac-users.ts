import { prisma } from "../src/lib/prisma";
import * as dotenv from "dotenv";

dotenv.config();

async function listUsers() {
  try {
    const users = await (prisma as any).rbacUser.findMany({
      select: { email: true, role: true }
    });
    console.log("Usuarios encontrados:", JSON.stringify(users, null, 2));
  } catch (error) {
    console.error("Error listing users:", error);
  }
}

listUsers().finally(() => (prisma as any).$disconnect?.());
