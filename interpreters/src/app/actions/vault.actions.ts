"use server";

import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth-rbac";
import { encryptPassword } from "@/lib/vault-crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const CreateAccountSchema = z.object({
  platformName: z.string().min(1, "Platform name is required"),
  url: z.string().optional(),
  vpnConfig: z.string().optional(),
  credentials: z.string().min(1, "Credentials are required"),
  notes: z.string().optional(),
  interpreterId: z.string().optional(),
});

export async function createVaultAccount(formData: FormData) {
  const session = await requireRole("HOLDER", "ADMIN");
  
  const rawData = {
    platformName: formData.get("platformName") as string,
    url: formData.get("url") as string,
    vpnConfig: formData.get("vpnConfig") as string,
    credentials: formData.get("credentials") as string,
    notes: formData.get("notes") as string,
    interpreterId: formData.get("interpreterId") as string || undefined,
  };

  const parsed = CreateAccountSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: "Invalid data provided.", details: parsed.error.flatten() };
  }

  const { platformName, url, vpnConfig, credentials, notes, interpreterId } = parsed.data;

  try {
    const encryptedCredentials = encryptPassword(credentials);

    await prisma.vaultAccount.create({
      data: {
        platformName,
        url,
        vpnConfig,
        credentials: encryptedCredentials,
        notes,
        holderId: session.user.id,
        interpreterId: interpreterId || null,
      },
    });

    revalidatePath("/portal-rbac/holder/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error creating vault account:", error);
    return { error: "Failed to create vault account." };
  }
}
