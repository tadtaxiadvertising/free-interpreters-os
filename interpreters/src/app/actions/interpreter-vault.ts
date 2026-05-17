"use server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { decryptPassword } from "@/lib/vault-crypto";
import { redirect } from "next/navigation";

export async function getVaultAccountsForCurrentInterpreter() {
  const { user } = await auth();
  if (!user || !user.email) {
    redirect("/login");
  }

  // Find the corresponding RBAC user by email
  const rbacUser = await prisma.rbacUser.findUnique({
    where: { email: user.email },
  });

  if (!rbacUser) {
    return [];
  }

  const accounts = await prisma.vaultAccount.findMany({
    where: { interpreterId: rbacUser.id },
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

export async function getVaultMessagesForCurrentInterpreter() {
  const { user } = await auth();
  if (!user || !user.email) {
    redirect("/login");
  }

  // Find the corresponding RBAC user by email
  const rbacUser = await prisma.rbacUser.findUnique({
    where: { email: user.email },
  });

  if (!rbacUser) {
    return [];
  }

  return prisma.vaultMessage.findMany({
    where: {
      status: "APPROVED",
      OR: [
        { recipientId: rbacUser.id },
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
