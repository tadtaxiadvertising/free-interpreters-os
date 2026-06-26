'use client';

import { deleteRecord, editRecord } from '@/app/actions/admin-actions';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

/* ── Types ──────────────────────────────────────────────── */

type LogRow = {
  id: number;
  interpreterId: number | null;
  date: string;
  interpretedMinutes: number;
  callsAttended: number;
  adherence: number;
  status: string;
  observaciones: string | null;
  interpreterName: string;
};

/* ── Client-side Zod schema — only editable fields ── */

const EditFormSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido (YYYY-MM-DD)'),
  interpretedMinutes: z
    .number({ message: 'Número inválido' })
    .int({ message: 'Debe ser entero' })
    .min(0, { message: 'Mínimo 0' })
    .max(1440, { message: 'Máximo 1440' }),
  callsAttended: z
    .number({ message: 'Número inválido' })
    .int({ message: 'Debe ser entero' })
    .min(0, { message: 'Mínimo 0' }),
  adherence: z
    .number({ message: 'Número inválido' })
    .min(0, { message: 'Mínimo 0%' })
    .max(100, { message: 'Máximo 100%' }),
  status: z
    .string()
    .trim()
    .min(1, { message: 'Estado requerido' })
    .max(40, { message: 'Máximo 40 caracteres' }),
  observaciones: z
    .string()
    .max(1000, { message: 'Máximo 1000 caracteres' }),
});

type EditFormData = z.infer<typeof EditFormSchema>;

/* ── Component ──────────────────────────────────────────── */

export function ProductionLogActions({ log }: { log: LogRow }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── react-hook-form ────────────────────────────────────── */

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormData>({
    resolver: zodResolver(EditFormSchema),
    defaultValues: {
      date: log.date,
      interpretedMinutes: log.interpretedMinutes,
      callsAttended: log.callsAttended,
      adherence: log.adherence,
      status: log.status,
      observaciones: log.observaciones ?? '',
    },
  });

  /* Reset form to fresh prop values whenever the modal opens */

  useEffect(() => {
    if (editOpen) {
      reset({
        date: log.date,
        interpretedMinutes: log.interpretedMinutes,
        callsAttended: log.callsAttended,
        adherence: log.adherence,
        status: log.status,
        observaciones: log.observaciones ?? '',
      });
    }
  }, [editOpen, log, reset]);

  /* ── Scroll lock ────────────────────────────────────────── */

  useEffect(() => {
    if (editOpen || deleteOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [editOpen, deleteOpen]);

  /* ── Escape key ─────────────────────────────────────────── */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (deleteOpen) setDeleteOpen(false);
        else if (editOpen) setEditOpen(false);
      }
    }
    if (editOpen || deleteOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editOpen, deleteOpen]);

  /* ── Close dropdown on outside click ────────────────────── */

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  /* ── Handlers ────────────────────────────────────────────── */

  const onEditSubmit = useCallback(
    (data: EditFormData) => {
      startTransition(async () => {
        const result = await editRecord({
          id: log.id,
          interpreterId: log.interpreterId ?? undefined,
          ...data,
          observaciones: data.observaciones || null,
        });
        if (result.success) {
          toast.success(result.message ?? 'Registro actualizado.');
          setEditOpen(false);
          router.refresh();
        } else {
          toast.error(result.error ?? 'No se pudo actualizar.');
        }
      });
    },
    [log.id, log.interpreterId, router],
  );

  const onDelete = useCallback(() => {
    startTransition(async () => {
      const result = await deleteRecord({
        id: log.id,
        interpreterId: log.interpreterId ?? undefined,
      });
      if (result.success) {
        toast.success(result.message ?? 'Registro eliminado.');
        setDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? 'No se pudo eliminar.');
      }
    });
  }, [log.id, log.interpreterId, router]);

  /* ── Shared input classes ────────────────────────────────── */

  const baseInput =
    'w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none transition-colors';

  const inputCls = cn(baseInput, 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20');
  const errorInputCls = cn(baseInput, 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20');

  /* ── Inline error helper ─────────────────────────────────── */

  function FieldError({ name }: { name: keyof EditFormData }) {
    const err = errors[name];
    if (!err) return null;
    return <p className="text-xs text-red-600 mt-1">{err.message}</p>;
  }

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <>
      {/* ── Dropdown trigger ──────────────────────────────── */}
      <div ref={menuRef} className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Abrir acciones"
        >
          <MoreVertical size={20} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl">
            <button
              type="button"
              onClick={() => { setEditOpen(true); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-gray-200 hover:bg-white/10"
            >
              <Pencil size={16} /> Editar
            </button>
            <button
              type="button"
              onClick={() => { setDeleteOpen(true); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-300 hover:bg-red-500/10"
            >
              <Trash2 size={16} /> Eliminar
            </button>
          </div>
        )}
      </div>

      {/* ── Edit Modal (portal → body) ────────────────────── */}
      {editOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-log-${log.id}`}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in"
              onClick={() => setEditOpen(false)}
            />

            {/* Modal panel */}
            <div className="modal-light relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in">
              {/* Header */}
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3
                    id={`edit-log-${log.id}`}
                    className="text-xl font-semibold text-gray-900"
                  >
                    Editar registro
                  </h3>
                  <p className="text-sm text-gray-500">{log.interpreterName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onEditSubmit)} noValidate>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Date */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Fecha</label>
                    <input
                      type="date"
                      {...register('date')}
                      className={errors.date ? errorInputCls : inputCls}
                    />
                    <FieldError name="date" />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Estado</label>
                    <input
                      {...register('status')}
                      className={errors.status ? errorInputCls : inputCls}
                    />
                    <FieldError name="status" />
                  </div>

                  {/* Interpreted Minutes */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Minutos</label>
                    <input
                      type="number"
                      min={0}
                      max={1440}
                      {...register('interpretedMinutes', { valueAsNumber: true })}
                      className={errors.interpretedMinutes ? errorInputCls : inputCls}
                    />
                    <FieldError name="interpretedMinutes" />
                  </div>

                  {/* Calls Attended */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Llamadas</label>
                    <input
                      type="number"
                      min={0}
                      {...register('callsAttended', { valueAsNumber: true })}
                      className={errors.callsAttended ? errorInputCls : inputCls}
                    />
                    <FieldError name="callsAttended" />
                  </div>

                  {/* Adherence */}
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Adherencia (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      {...register('adherence', { valueAsNumber: true })}
                      className={errors.adherence ? errorInputCls : inputCls}
                    />
                    <FieldError name="adherence" />
                  </div>

                  {/* Observaciones */}
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Observaciones</label>
                    <textarea
                      {...register('observaciones')}
                      rows={3}
                      className={errors.observaciones ? errorInputCls : inputCls}
                    />
                    <FieldError name="observaciones" />
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isPending ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Delete Modal (portal → body) ──────────────────── */}
      {deleteOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-log-${log.id}`}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in"
              onClick={() => setDeleteOpen(false)}
            />

            {/* Modal panel */}
            <div className="modal-light relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in">
              <h3
                id={`delete-log-${log.id}`}
                className="text-xl font-semibold text-gray-900"
              >
                Eliminar registro
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Esta acción eliminará el registro de producción de{' '}
                <span className="font-medium text-gray-700">{log.interpreterName}</span>{' '}
                y actualizará las vistas relacionadas.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isPending ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
