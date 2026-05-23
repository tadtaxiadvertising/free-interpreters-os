'use client';

import { useMemo, useOptimistic, useState, useTransition } from 'react';
import { Loader2, MoreVertical, Search } from 'lucide-react';
import { updateInterpreterStatusAction } from '@/app/actions/interpreters';
import type { UpdateInterpreterStatusInput } from '@/lib/validators/interpreters';

type InterpreterStatus = 'Activo' | 'Training' | 'Inactivo' | 'Probation';

type InterpreterRosterItem = {
  id: number;
  name: string;
  externalId: string;
  campaign?: string | null;
  status?: string | null;
};

type InterpreterRosterProps = {
  interpreters: InterpreterRosterItem[];
};

const STATUS_OPTIONS: InterpreterStatus[] = ['Activo', 'Training', 'Inactivo', 'Probation'];

export default function InterpreterRoster({ interpreters }: InterpreterRosterProps) {
  const [query, setQuery] = useState('');
  const [stableInterpreters, setStableInterpreters] = useState(interpreters);
  const [isPending, startTransition] = useTransition();
  const [optimisticInterpreters, setOptimisticInterpreters] = useOptimistic(
    stableInterpreters,
    (state, payload: UpdateInterpreterStatusInput) =>
      state.map((interpreter) =>
        interpreter.id === payload.id ? { ...interpreter, status: payload.status } : interpreter
      )
  );

  const filteredInterpreters = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return optimisticInterpreters;

    return optimisticInterpreters.filter((interpreter) =>
      [interpreter.name, interpreter.externalId].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [optimisticInterpreters, query]);

  const handleStatusChange = (id: number, status: InterpreterStatus) => {
    const previousInterpreter = stableInterpreters.find((interpreter) => interpreter.id === id);
    const payload: UpdateInterpreterStatusInput = { id, status };
    setOptimisticInterpreters(payload);

    startTransition(async () => {
      const result = await updateInterpreterStatusAction(payload);
      if (!result.success) {
        if (previousInterpreter?.status) {
          setStableInterpreters((currentState) =>
            currentState.map((interpreter) =>
              interpreter.id === id ? { ...interpreter, status: previousInterpreter.status } : interpreter
            )
          );
        }
        alert(result.error || 'No se pudo actualizar el estado del intérprete.');
        return;
      }

      setStableInterpreters((currentState) =>
        currentState.map((interpreter) =>
          interpreter.id === id ? { ...interpreter, status } : interpreter
        )
      );
    });
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 p-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Command Center · Master Roster</h2>
          <p className="text-xs text-gray-400">Gestión rápida de estado operativo en tiempo real.</p>
        </div>
        <div className="relative min-w-64 flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre o External ID"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 py-2 pl-9 pr-3 text-sm text-gray-100 outline-none ring-0 placeholder:text-gray-500 focus:border-gray-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-800 text-sm text-gray-200">
          <thead className="bg-gray-950/80 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left font-medium">External ID</th>
              <th className="px-3 py-2 text-left font-medium">Nombre</th>
              <th className="px-3 py-2 text-left font-medium">Campaña</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium"><MoreVertical className="ml-auto h-4 w-4" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredInterpreters.map((interpreter) => (
              <tr key={interpreter.id} className="hover:bg-gray-800/50">
                <td className="px-3 py-2 text-xs text-gray-300">{interpreter.externalId}</td>
                <td className="px-3 py-2 text-sm font-medium text-gray-100">{interpreter.name}</td>
                <td className="px-3 py-2 text-xs text-gray-300">{interpreter.campaign || '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={(interpreter.status as InterpreterStatus) || 'Activo'}
                      onChange={(event) =>
                        handleStatusChange(interpreter.id, event.target.value as InterpreterStatus)
                      }
                      className="rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100"
                      disabled={isPending}
                    >
                      {STATUS_OPTIONS.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption}
                        </option>
                      ))}
                    </select>
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /> : null}
                  </div>
                </td>
                <td className="px-3 py-2" />
              </tr>
            ))}
            {filteredInterpreters.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-400">
                  No se encontraron intérpretes para “{query}”.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
