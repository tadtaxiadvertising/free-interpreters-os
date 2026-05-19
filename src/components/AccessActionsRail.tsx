import React, { Suspense } from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import prismaClient from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getInterpreterVault(userId: string) {
  try {
    const user = await prismaClient.rbacUser.findUnique({
      where: { id: userId },
      select: { email: true, role: true }
    });

    if (!user) {
      // Intentar vincular por perfil de usuario
      const profile = await prismaClient.userProfile.findUnique({
        where: { id: userId },
        select: { email: true }
      });
      if (profile?.email) {
        const rbacUser = await prismaClient.rbacUser.findUnique({
          where: { email: profile.email }
        });
        if (rbacUser) {
          return prismaClient.vaultAccount.findMany({
            where: { interpreterId: rbacUser.id },
            select: { id: true, platformName: true, url: true }
          });
        }
      }
      return [];
    }

    return prismaClient.vaultAccount.findMany({
      where: { interpreterId: userId },
      select: { id: true, platformName: true, url: true }
    });
  } catch (e) {
    console.error('[AccessActionsRail] Error fetching vault:', e);
    return [];
  }
}

function RailSkeleton() {
  return (
    <div className="flex overflow-x-auto gap-3 py-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {[1, 2, 3].map(i => (
        <div 
          key={i} 
          className="h-10 w-32 bg-slate-800/50 rounded-xl animate-pulse shrink-0 border border-slate-700/50" 
        />
      ))}
    </div>
  );
}

async function RailContent({ userId }: { userId: string }) {
  const accounts = await getInterpreterVault(userId);

  if (accounts.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-2 px-4 bg-slate-900/30 rounded-xl border border-slate-800/50 inline-block">
        No hay accesos a plataformas asignados.
      </div>
    );
  }

  return (
    <div className="flex overflow-x-auto gap-3 pb-2 -mb-2 md:flex-wrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {accounts.map(acc => {
        const url = acc.url && acc.url.startsWith('http') ? acc.url : `https://${acc.url || '#'}`;
        return (
          <a
            key={acc.id}
            href={acc.url ? url : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-transparent hover:bg-slate-800/80 hover:text-white rounded-xl border border-slate-200/10 transition-colors shrink-0 group"
            title={acc.platformName}
          >
            <Globe size={16} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
            <span className="truncate max-w-[150px]">{acc.platformName}</span>
            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-slate-400" />
          </a>
        );
      })}
    </div>
  );
}

export function AccessActionsRail({ userId }: { userId: string }) {
  return (
    <div className="mt-6 border-t border-slate-200/10 pt-5">
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Plataformas de Trabajo</h4>
      <Suspense fallback={<RailSkeleton />}>
        <RailContent userId={userId} />
      </Suspense>
    </div>
  );
}
