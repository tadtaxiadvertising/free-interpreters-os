"use server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth-rbac";
import { decryptPassword } from "@/lib/vault-crypto";

export async function getInterpreterAccounts() {
  const session = await requireRole("INTERPRETER", "ADMIN");
  
  const accounts = await prisma.vaultAccount.findMany({
    where: { interpreterId: session.user.id },
    include: { holder: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return accounts.map(acc => {
    let decrypted = "ERROR_DECRYPT";
    try {
      decrypted = decryptPassword(acc.credentials);
    } catch (e) {
      console.error(`Decryption failed for account ${acc.id}`);
    }
    
    return {
      ...acc,
      decryptedCredentials: decrypted
    };
  });
}

export async function listInterpreterMessages() {
  const session = await requireRole("INTERPRETER", "ADMIN");
  return prisma.vaultMessage.findMany({
    where: {
      status: "APPROVED",
      OR: [
        { recipientId: session.user.id },
        { recipientId: null }
      ]
    },
    include: {
      author: {
        select: {
          name: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}
