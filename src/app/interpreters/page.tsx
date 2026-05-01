import React from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddInterpreterButton } from '@/components/AddInterpreterButton';
import { InterpreterActions } from '@/components/InterpreterActions';
import { ExportInterpretersButton } from '@/components/ExportInterpretersButton';

export const dynamic = 'force-dynamic';

async function getInterpreters() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const res = await fetch(`${apiUrl}/api/interpreters`, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`API returned status ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching interpreters:', error);
    return [];
  }
}

export default async function InterpretersPage() {
  const interpreters = await getInterpreters();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Interpreter Roster</h2>
          <p className="text-gray-400">Manage your global network of interpreters</p>
        </div>
        <div className="flex gap-4">
          <ExportInterpretersButton data={interpreters} />
          <AddInterpreterButton />
        </div>
      </header>

      {/* Filters & Search */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, ID or campaign..." 
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-gray-300 hover:bg-white/10 transition-colors">
          <Filter size={18} />
          Filters
        </button>
      </div>

      {/* Interpreters Grid/Table */}
      <div className="glass rounded-3xl overflow-visible">
        <table className="w-full text-left">
          <thead>
            <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
              <th className="py-6 px-8">Interpreter</th>
              <th className="py-6 px-4">Status</th>
              <th className="py-6 px-4">Campaign</th>
              <th className="py-6 px-4 text-center">Hourly / Min</th>
              <th className="py-6 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {interpreters.map((interpreter) => (
              <tr key={interpreter.id} className="group hover:bg-white/5 transition-colors">
                <td className="py-6 px-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 font-bold text-lg border border-white/5">
                      {interpreter.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-blue-400 transition-colors">
                        {interpreter.name}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        ID: {interpreter.externalId}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-6 px-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold",
                    interpreter.status === 'Activo' ? "bg-green-500/10 text-green-400" :
                    interpreter.status === 'Probation' ? "bg-yellow-500/10 text-yellow-400" :
                    "bg-gray-500/10 text-gray-400"
                  )}>
                    {interpreter.status}
                  </span>
                </td>
                <td className="py-6 px-4 text-gray-300">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500/50" />
                    {interpreter.campaign || 'N/A'}
                  </span>
                </td>
                <td className="py-6 px-4 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-white font-mono font-bold">${(parseFloat(interpreter.tariffPerMinute.toString()) * 60).toFixed(2)}/hr</span>
                    <span className="text-[10px] text-gray-500 font-mono tracking-tight">${interpreter.tariffPerMinute.toString()}/min</span>
                  </div>
                </td>
                <td className="py-6 px-4 text-right">
                  <InterpreterActions interpreter={interpreter} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {interpreters.length === 0 && (
          <div className="p-20 text-center">
            <Users size={48} className="mx-auto text-gray-700 mb-4" />
            <p className="text-gray-500">No interpreters found in the database.</p>
          </div>
        )}
      </div>
    </div>
  );
}
