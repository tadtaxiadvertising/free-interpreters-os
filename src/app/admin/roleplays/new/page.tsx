import React from 'react';
import { Mic2, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import NewRoleplayForm from './NewRoleplayForm';

async function getInterpreters() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/interpreters?active=true`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

async function getCandidates() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/recruitment/candidates?status=Aplicante`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export default async function NewRoleplayPage() {
  const [interpreters, candidates] = await Promise.all([getInterpreters(), getCandidates()]);
  
  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/admin/roleplays"
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Create Roleplay Session</h1>
            <p className="text-gray-400">Assign a base audio and select a participant</p>
          </div>
        </div>

        <NewRoleplayForm interpreters={interpreters} candidates={candidates} />
      </div>
    </div>
  );
}