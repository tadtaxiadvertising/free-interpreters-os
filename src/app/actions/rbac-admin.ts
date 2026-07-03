"use server";
import { auth } from "@/lib/auth-rbac";
import prisma from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
const HolderSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(6),
  name: z.string()
});

export async function createHolder(data: z.infer<typeof HolderSchema>) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin role required");
  }

  const { email, password, name } = HolderSchema.parse(data);
  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.rbacUser.create({
    data: { email, password: hashedPassword, name, role: "HOLDER" }
  });
}
