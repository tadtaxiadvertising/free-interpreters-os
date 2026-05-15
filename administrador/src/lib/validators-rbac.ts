"use strict";
import { z } from "zod";

// ── Vault Account Schemas ──────────────────────────────────────
export const VaultAccountCreateSchema = z.object({
  platformName: z.string().min(1, "Platform name required").max(100),
  url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  vpnConfig: z.string().max(500).optional().or(z.literal("")),
  credentials: z.string().min(1, "Credentials required").max(2000),
  notes: z.string().max(1000).optional().or(z.literal("")),
  interpreterId: z.string().optional().or(z.literal("")),
});
export type VaultAccountCreateInput = z.infer<typeof VaultAccountCreateSchema>;

export const VaultAccountUpdateSchema = VaultAccountCreateSchema.partial().extend({
  id: z.string().cuid(),
});

// ── Vault Message Schemas ──────────────────────────────────────
export const VaultMessageCreateSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(5000),
  recipientId: z.string().optional().or(z.literal("")),
});
export type VaultMessageCreateInput = z.infer<typeof VaultMessageCreateSchema>;

export const VaultMessageModerateSchema = z.object({
  messageId: z.string().cuid(),
  action: z.enum(["APPROVED", "REJECTED"]),
});

// ── Holder Provisioning Schema (Admin) ─────────────────────────
export const HolderProvisionSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Minimum 8 characters"),
  name: z.string().min(2, "Name required").max(100),
});
export type HolderProvisionInput = z.infer<typeof HolderProvisionSchema>;

// ── Interpreter Provisioning Schema (Admin) ────────────────────
export const InterpreterProvisionSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Minimum 8 characters"),
  name: z.string().min(2, "Name required").max(100),
});
export type InterpreterProvisionInput = z.infer<typeof InterpreterProvisionSchema>;

// ── Account Assignment Schema (Holder) ─────────────────────────
export const AccountAssignSchema = z.object({
  accountId: z.string().cuid(),
  interpreterId: z.string().cuid(),
});
