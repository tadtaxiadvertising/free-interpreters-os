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
