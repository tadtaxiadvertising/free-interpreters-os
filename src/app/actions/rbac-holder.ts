"use server";
import { requireRole } from "@/lib/auth-rbac";
import prisma from "@/lib/prisma";
import {
  VaultAccountCreateSchema,
  VaultMessageCreateSchema,
  AccountAssignSchema,
} from "@/lib/validators-rbac";

// ── Upload Account (Holder Only) ───────────────────────────────
export async function uploadAccount(data: unknown) {
  const session = await requireRole("HOLDER");
  const parsed = VaultAccountCreateSchema.parse(data);

  return (prisma as any).vaultAccount.create({
    data: {
      platformName: parsed.platformName,
      url: parsed.url || null,
      vpnConfig: parsed.vpnConfig || null,
      credentials: parsed.credentials,
      notes: parsed.notes || null,
      holderId: session.user.id,
      interpreterId: parsed.interpreterId || null,
    },
    select: {
      id: true,
      platformName: true,
      url: true,
      createdAt: true,
    },
  });
}

// ── List Holder's Accounts ─────────────────────────────────────
export async function listHolderAccounts() {
  const session = await requireRole("HOLDER");

  return (prisma as any).vaultAccount.findMany({
    where: { holderId: session.user.id },
    include: {
      interpreter: { select: { id: true, name: true, email: true } },
      attachments: { select: { id: true, fileName: true, fileUrl: true, uploadedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Assign Interpreter to Account ──────────────────────────────
export async function assignInterpreter(data: unknown) {
  const session = await requireRole("HOLDER");
  const { accountId, interpreterId } = AccountAssignSchema.parse(data);

  // Data isolation: ensure the account belongs to this holder
  const account = await (prisma as any).vaultAccount.findFirst({
    where: { id: accountId, holderId: session.user.id },
  });

  if (!account) {
    throw new Error("Account not found or access denied");
  }

  // Verify interpreter exists and has INTERPRETER role
  const interpreter = await (prisma as any).rbacUser.findFirst({
    where: { id: interpreterId, role: "INTERPRETER" },
  });

  if (!interpreter) {
    throw new Error("Interpreter not found");
  }

  return (prisma as any).vaultAccount.update({
    where: { id: accountId },
    data: { interpreterId },
  });
}

// ── Send Message (Holder → Admin Moderation) ───────────────────
export async function sendMessage(data: unknown) {
  const session = await requireRole("HOLDER");
  const parsed = VaultMessageCreateSchema.parse(data);

  return (prisma as any).vaultMessage.create({
    data: {
      content: parsed.content,
      authorId: session.user.id,
      recipientId: parsed.recipientId || null,
      status: "PENDING_ADMIN",  // Always requires admin approval
    },
  });
}

// ── List Holder's Messages ─────────────────────────────────────
export async function listHolderMessages() {
  const session = await requireRole("HOLDER");

  return (prisma as any).vaultMessage.findMany({
    where: { authorId: session.user.id },
    include: {
      recipient: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── List Available Interpreters (for assignment dropdown) ──────
export async function listAvailableInterpreters() {
  await requireRole("HOLDER");

  return (prisma as any).rbacUser.findMany({
    where: { role: "INTERPRETER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

// ── Delete Account (Holder Only, own accounts) ─────────────────
export async function deleteAccount(accountId: string) {
  const session = await requireRole("HOLDER");

  const account = await (prisma as any).vaultAccount.findFirst({
    where: { id: accountId, holderId: session.user.id },
  });

  if (!account) {
    throw new Error("Account not found or access denied");
  }

  return (prisma as any).vaultAccount.delete({
    where: { id: accountId },
  });
}
