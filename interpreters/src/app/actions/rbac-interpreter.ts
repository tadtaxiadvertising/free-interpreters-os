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
      OR: [
        { authorId: session.user.id },
        { recipientId: session.user.id, status: "APPROVED" },
        { recipientId: null, status: "APPROVED", authorId: { not: session.user.id } }
      ]
    },
    include: {
      author: {
        select: {
          name: true,
          role: true
        }
      },
      recipient: {
        select: {
          name: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function sendMessageAsInterpreter(data: any) {
  const session = await requireRole("INTERPRETER", "ADMIN");
  const content = data.content as string;
  
  if (!content || content.trim().length === 0) {
    throw new Error("El contenido del mensaje es requerido");
  }

  return prisma.vaultMessage.create({
    data: {
      content,
      authorId: session.user.id,
      recipientId: null, // Always goes to admin for global/review
      status: "PENDING_ADMIN",
    },
  });
}
