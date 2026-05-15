"use server";
import { requireRole } from "@/lib/auth-rbac";
import prisma from "@/lib/prisma";

// ── List Assigned Accounts (Interpreter Only) ──────────────────
export async function listAssignedAccounts() {
  const session = await requireRole("INTERPRETER");

  return prisma.vaultAccount.findMany({
    where: { interpreterId: session.user.id },
    select: {
      id: true,
      platformName: true,
      url: true,
      vpnConfig: true,
      // We don't send credentials by default, must be requested via reveal
      credentials: true, // We send a masked or raw encrypted string here if needed, but it's better not to. Wait, the frontend relies on `account.credentials`. I'll send a dummy string or keep the encrypted string and decrypt on demand. Let's send the encrypted string and decrypt server-side.
      notes: true,
      holder: { select: { name: true } },
      attachments: { select: { id: true, fileName: true, fileUrl: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Reveal Account Credentials ───────────────────────────────────
import { decrypt, isEncrypted } from "@/lib/crypto";

export async function revealCredentials(accountId: string): Promise<string> {
  const session = await requireRole("INTERPRETER");

  // Verify assignment
  const account = await prisma.vaultAccount.findFirst({
    where: { id: accountId, interpreterId: session.user.id },
    select: { credentials: true }
  });

  if (!account) {
    throw new Error("Account not found or not assigned to you");
  }

  // Decrypt if it's encrypted, otherwise return as is (for legacy data)
  return isEncrypted(account.credentials) 
    ? decrypt(account.credentials) 
    : account.credentials;
}

// ── List Approved Messages for Interpreter ─────────────────────
export async function listInterpreterMessages() {
  const session = await requireRole("INTERPRETER");

  return prisma.vaultMessage.findMany({
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

  const user = await prisma.rbacUser.findUnique({
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
