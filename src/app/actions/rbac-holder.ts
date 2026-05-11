"use server";
import { auth } from "@/lib/auth-rbac";
import prisma from "@/lib/prisma";
import { z } from "zod";
const AccountSchema = z.object({ platformName: z.string(), credentials: z.string() });
const MessageSchema = z.object({ content: z.string() });

export async function uploadAccount(data: z.infer<typeof AccountSchema>) {
  const session = await auth();
  if (!session || !session.user || (session.user as any).role !== "HOLDER") {
    throw new Error("Unauthorized");
  }
  
  const parsed = AccountSchema.parse(data);
  // @ts-ignore: Prisma client cache delay in IDE
  return prisma.vaultAccount.create({ 
    data: { ...parsed, holderId: session.user.id as string } 
  });
}

export async function sendMessage(data: z.infer<typeof MessageSchema>) {
  const session = await auth();
  if (!session || !session.user || (session.user as any).role !== "HOLDER") {
    throw new Error("Unauthorized");
  }
  
  const parsed = MessageSchema.parse(data);
  // @ts-ignore: Prisma client cache delay in IDE
  return prisma.vaultMessage.create({ 
    data: { ...parsed, authorId: session.user.id as string } 
  });
}
