import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ChatSystem } from '@/components/ChatSystem';
import prismaClient from '@/lib/prisma';

const prisma = prismaClient;

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  const { userId, user } = await auth();
  if (!userId || !user) redirect('/login');

  // Verify that the user is actually an admin
  const profile = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!profile || profile.role !== 'admin') {
    redirect('/unauthorized');
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Mensajería y Soporte</h1>
        <p className="text-slate-400 mt-2">
          Chat en tiempo real con los intérpretes de la plataforma.
        </p>
      </div>

      <ChatSystem currentUserId={userId} currentUserRole="admin" />
    </div>
  );
}
