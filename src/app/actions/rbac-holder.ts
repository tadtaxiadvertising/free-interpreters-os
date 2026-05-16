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
