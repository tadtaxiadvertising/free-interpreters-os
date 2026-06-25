"use client";

import { deleteRecord, editRecord } from "@/app/actions/admin-actions";
import { Loader2, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";

type LogRow = { id: number; interpreterId: number | null; date: string; interpretedMinutes: number; callsAttended: number; adherence: number; status: string; observaciones: string | null; interpreterName: string };

export function ProductionLogActions({ log }: { log: LogRow }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onEdit(formData: FormData) {
    startTransition(async () => {
      const result = await editRecord({
        id: log.id,
        interpreterId: log.interpreterId ?? undefined,
        date: String(formData.get("date") ?? ""),
        interpretedMinutes: formData.get("interpretedMinutes"),
        callsAttended: formData.get("callsAttended"),
        adherence: formData.get("adherence"),
        status: String(formData.get("status") ?? ""),
        observaciones: String(formData.get("observaciones") ?? ""),
      });
      if (result.success) {
        toast.success(result.message ?? "Registro actualizado.");
        setEditOpen(false);
        router.refresh();
      } else toast.error(result.error ?? "No se pudo actualizar.");
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteRecord({ id: log.id, interpreterId: log.interpreterId ?? undefined });
      if (result.success) {
        toast.success(result.message ?? "Registro eliminado.");
        setDeleteOpen(false);
        router.refresh();
      } else toast.error(result.error ?? "No se pudo eliminar.");
    });
  }

  return (
    <>
      <div className="relative inline-block text-left">
        <button type="button" onClick={() => setMenuOpen((open) => !open)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Abrir acciones">
          <MoreVertical size={20} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl">
            <button type="button" onClick={() => { setEditOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-gray-200 hover:bg-white/10"><Pencil size={16} /> Editar</button>
            <button type="button" onClick={() => { setDeleteOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-300 hover:bg-red-500/10"><Trash2 size={16} /> Eliminar</button>
          </div>
        )}
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby={`edit-log-${log.id}`}>
          <form action={onEdit} className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4"><div><h3 id={`edit-log-${log.id}`} className="text-xl font-bold text-white">Editar registro</h3><p className="text-sm text-gray-400">{log.interpreterName}</p></div><button type="button" onClick={() => setEditOpen(false)} className="rounded-xl p-2 text-gray-400 hover:bg-white/10 hover:text-white"><X size={18} /></button></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-300">Fecha<input name="date" type="date" defaultValue={log.date} required className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-blue-400" /></label>
              <label className="text-sm text-gray-300">Estado<input name="status" defaultValue={log.status} required className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-blue-400" /></label>
              <label className="text-sm text-gray-300">Minutos<input name="interpretedMinutes" type="number" min="0" max="1440" defaultValue={log.interpretedMinutes} required className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-blue-400" /></label>
              <label className="text-sm text-gray-300">Llamadas<input name="callsAttended" type="number" min="0" defaultValue={log.callsAttended} required className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-blue-400" /></label>
              <label className="text-sm text-gray-300 sm:col-span-2">Adherencia (%)<input name="adherence" type="number" min="0" max="100" step="0.01" defaultValue={log.adherence} required className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-blue-400" /></label>
              <label className="text-sm text-gray-300 sm:col-span-2">Observaciones<textarea name="observaciones" defaultValue={log.observaciones ?? ""} rows={3} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-blue-400" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditOpen(false)} className="rounded-xl border border-white/10 px-4 py-2 text-gray-300 hover:bg-white/10">Cancelar</button><button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500 disabled:opacity-60">{isPending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar</button></div>
          </form>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby={`delete-log-${log.id}`}>
          <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-slate-950 p-6 shadow-2xl"><h3 id={`delete-log-${log.id}`} className="text-xl font-bold text-white">Eliminar registro</h3><p className="mt-2 text-sm text-gray-400">Esta acción eliminará el registro de producción de {log.interpreterName} y actualizará las vistas relacionadas.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDeleteOpen(false)} className="rounded-xl border border-white/10 px-4 py-2 text-gray-300 hover:bg-white/10">Cancelar</button><button type="button" onClick={onDelete} disabled={isPending} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-500 disabled:opacity-60">{isPending && <Loader2 className="h-4 w-4 animate-spin" />} Eliminar</button></div></div>
        </div>
      )}
    </>
  );
}
