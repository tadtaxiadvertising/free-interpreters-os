'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ShieldAlert } from 'lucide-react';
import { evaluateRoleplay } from '@/app/actions/roleplays';

function SaveButton() { const { pending } = useFormStatus(); return <button disabled={pending} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:bg-slate-700">{pending ? 'Guardando…' : 'Guardar evaluación'}</button>; }
export function RoleplayEvaluationForm({ sessionId }: { sessionId: string }) {
  const [critical, setCritical] = useState(false);
  async function submit(formData: FormData) { await evaluateRoleplay(formData); }
  return <form action={submit} className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
    <input type="hidden" name="sessionId" value={sessionId} />
    <div className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"><input id="criticalError" name="criticalError" type="checkbox" checked={critical} onChange={(event) => setCritical(event.target.checked)} className="mt-1 h-4 w-4 accent-red-500" /><label htmlFor="criticalError" className="text-sm text-slate-200"><ShieldAlert className="mr-2 inline text-red-300" size={17} /><strong>Error crítico.</strong> Fuerza el puntaje final a 0.00.</label></div>
    <div className="grid gap-4 sm:grid-cols-2">{[['protocolScore', 'Protocolo (20%)'], ['interpretationScore', 'Interpretación (40%)'], ['languageScore', 'Idioma (20%)'], ['serviceScore', 'Servicio (10%)'], ['technicalScore', 'Técnico (10%)']].map(([name, label]) => <label key={name} className="text-sm font-medium text-slate-300">{label}<input disabled={critical} required type="number" min="0" max="100" defaultValue="100" name={name} className="mt-2 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white disabled:opacity-40" /></label>)}</div>
    <label className="block text-sm font-medium text-slate-300">Comentarios<textarea name="comments" rows={4} className="mt-2 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white" /></label><SaveButton />
  </form>;
}
