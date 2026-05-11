"use server";
import { requireRole } from "@/lib/auth-rbac";
import prisma from "@/lib/prisma";

// ── List Assigned Accounts (Interpreter Only) ──────────────────
export async function listAssignedAccounts() {
  const session = await requireRole("INTERPRETER");

  return (prisma as any).vaultAccount.findMany({
    where: { interpreterId: session.user.id },
    select: {
      id: true,
      platformName: true,
      url: true,
      vpnConfig: true,
      credentials: true,
      notes: true,
      holder: { select: { name: true } },
      attachments: { select: { id: true, fileName: true, fileUrl: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── List Approved Messages for Interpreter ─────────────────────
export async function listInterpreterMessages() {
  const session = await requireRole("INTERPRETER");

  return (prisma as any).vaultMessage.findMany({
    where: {
      recipientId: session.user.id,
      status: "APPROVED",  // Only approved messages visible
    },
    include: {
      author: { select: { name: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Get Interpreter Profile ────────────────────────────────────
export async function getInterpreterProfile() {
  const session = await requireRole("INTERPRETER");

  const user = await (prisma as any).rbacUser.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      assignedAccounts: {
        select: { id: true, platformName: true },
      },
      createdAt: true,
    },
  });

  return user;
}
