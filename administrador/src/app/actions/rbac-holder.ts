"use server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth-rbac";

export async function getHolderStats() {
  const session = await requireRole("HOLDER", "ADMIN");
  
  const [accountCount, unassignedCount] = await Promise.all([
    prisma.vaultAccount.count({ where: { holderId: session.user.id } }),
    prisma.vaultAccount.count({ 
      where: { 
        holderId: session.user.id,
        interpreterId: null 
      } 
    }),
  ]);

  return {
    totalAccounts: accountCount,
    unassigned: unassignedCount,
    activeInterpreters: 0, // Placeholder for now
  };
}

export async function listHolderAccounts() {
  const session = await requireRole("HOLDER", "ADMIN");
  return prisma.vaultAccount.findMany({
    where: { holderId: session.user.id },
    include: { interpreter: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAvailableInterpreters() {
  await requireRole("HOLDER", "ADMIN");
  return prisma.rbacUser.findMany({
    where: { role: "INTERPRETER" },
    select: { id: true, name: true, email: true },
  });
}

export async function listHolderMessages() {
  const session = await requireRole("HOLDER", "ADMIN");
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
          id: true,
          name: true,
          role: true,
        },
      },
      recipient: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function sendMessage(data: any) {
  const session = await requireRole("HOLDER", "ADMIN");
  const content = data.content as string;
  const recipientId = data.recipientId as string || null;

  if (!content || content.trim().length === 0) {
    throw new Error("El contenido del mensaje es requerido");
  }

  return prisma.vaultMessage.create({
    data: {
      content,
      authorId: session.user.id,
      recipientId: recipientId || null,
      status: "PENDING_ADMIN",
    },
  });
}

