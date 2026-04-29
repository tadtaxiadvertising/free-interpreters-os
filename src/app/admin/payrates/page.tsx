import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DollarSign } from 'lucide-react';
import { PayrateEditor } from '@/components/PayrateEditor';

export const dynamic = 'force-dynamic';

export default async function PayratesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/login');

  const { data: interpreters } = await supabase
    .from('interpreters')
    .select('id, name, externalId, tariffPerMinute, campaign, status')
    .order('name');

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <DollarSign size={28} className="text-purple-400" />
          <h2 className="text-3xl font-bold text-white">Payrate Management</h2>
        </div>
        <p className="text-gray-400">Update interpreter tariffs. All changes are audited and take effect on the next call.</p>
      </header>

      <div className="glass rounded-3xl p-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                <th className="pb-3 px-2">Interpreter</th>
                <th className="pb-3 px-2">ID</th>
                <th className="pb-3 px-2">Campaign</th>
                <th className="pb-3 px-2">Status</th>
                <th className="pb-3 px-2">Current Rate</th>
                <th className="pb-3 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {interpreters?.map((interp) => (
                <PayrateEditor
                  key={interp.id}
                  interpreter={{
                    id: interp.id,
                    name: interp.name,
                    externalId: interp.externalId,
                    campaign: interp.campaign,
                    status: interp.status,
                    tariffPerMinute: Number(interp.tariffPerMinute),
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
