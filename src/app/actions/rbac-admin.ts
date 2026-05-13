"use server";
import { requireRole } from "@/lib/auth-rbac";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  HolderProvisionSchema,
  InterpreterProvisionSchema,
  VaultMessageModerateSchema,
} from "@/lib/validators-rbac";

// ── Create Holder Entity ───────────────────────────────────────
export async function createHolder(data: unknown) {
  await requireRole("ADMIN");
  const { email, password, name } = HolderProvisionSchema.parse(data);
  const hashedPassword = await bcrypt.hash(password, 12);

  return prisma.rbacUser.create({
    data: { email, password: hashedPassword, name, role: "HOLDER" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
}

// ── Create Interpreter Entity ──────────────────────────────────
export async function createInterpreter(data: unknown) {
  await requireRole("ADMIN");
  const { email, password, name } = InterpreterProvisionSchema.parse(data);
  const hashedPassword = await bcrypt.hash(password, 12);

  return prisma.rbacUser.create({
    data: { email, password: hashedPassword, name, role: "INTERPRETER" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
}

// ── List All Users by Role ─────────────────────────────────────
export async function listUsersByRole(role?: string) {
  await requireRole("ADMIN");
  const where = role ? { role: role as any } : {};

  return prisma.rbacUser.findMany({
    where,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

// ── Moderate Message ───────────────────────────────────────────
export async function moderateMessage(data: unknown) {
  await requireRole("ADMIN");
  const { messageId, action } = VaultMessageModerateSchema.parse(data);

  return prisma.vaultMessage.update({
    where: { id: messageId },
    data: { status: action },
  });
}

// ── List Pending Messages ──────────────────────────────────────
export async function listPendingMessages() {
  await requireRole("ADMIN");

  return prisma.vaultMessage.findMany({
    where: { status: "PENDING_ADMIN" },
    include: {
      author: { select: { id: true, name: true, email: true, role: true } },
      recipient: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Dashboard Stats ────────────────────────────────────────────
export async function getAdminStats() {
  await requireRole("ADMIN");

  const [holders, interpreters, accounts, pendingMessages] = await Promise.all([
    prisma.rbacUser.count({ where: { role: "HOLDER" } }),
    prisma.rbacUser.count({ where: { role: "INTERPRETER" } }),
    prisma.vaultAccount.count(),
    prisma.vaultMessage.count({ where: { status: "PENDING_ADMIN" } }),
  ]);

  return { holders, interpreters, accounts, pendingMessages };
}
