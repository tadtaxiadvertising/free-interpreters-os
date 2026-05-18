import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ChatSystem } from '@/components/ChatSystem';
import prismaClient from '@/lib/prisma';

const prisma = prismaClient;

export const dynamic = 'force-dynamic';

export default async function InterpreterMessagesPage() {
  const { userId, user } = await auth();
  if (!userId || !user) redirect('/login');

  const profile = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!profile || profile.role !== 'interpreter') {
    redirect('/unauthorized');
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Soporte y Mensajería</h1>
        <p className="text-slate-400 mt-2">
          Comunícate de forma directa y segura con el equipo de administración.
        </p>
      </div>

      <ChatSystem currentUserId={userId} currentUserRole="interpreter" />
    </div>
  );
}
