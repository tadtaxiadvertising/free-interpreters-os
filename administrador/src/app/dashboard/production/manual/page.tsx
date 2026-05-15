'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Clock, 
  Calendar, 
  PhoneCall, 
  MessageSquare, 
  Save, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { createInterpreterLog } from '@/app/actions/interpreter-logs';

export default function ManualLogPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createInterpreterLog(formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8">
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 group w-fit"
        >
          <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
            <ArrowLeft size={18} />
          </div>
          <span className="font-medium">Volver al Dashboard</span>
        </Link>
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">Registro de Producción</h1>
        <p className="text-slate-400 text-lg">Ingresa tus minutos trabajados de forma manual</p>
      </div>

      <div className="glass rounded-[2.5rem] p-10 border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-32 bg-blue-500/5 blur-[80px] rounded-full -mr-16 -mt-16 pointer-events-none" />
        
        {success ? (
          <div className="py-12 text-center animate-in zoom-in duration-500">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">¡Registro Exitoso!</h2>
            <p className="text-slate-400">Tus minutos han sido guardados y la nómina actualizada.</p>
            <p className="text-slate-500 text-sm mt-8">Redirigiendo al panel principal...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            {error && (
              <div className="flex items-center gap-3 p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 animate-in shake duration-500">
                <AlertCircle size={20} />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} className="text-blue-400" />
                  Fecha de Sesión
                </label>
                <div className="relative">
                  <input 
                    type="date" 
                    name="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={14} className="text-blue-400" />
                  Minutos Interpretados
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    name="minutes"
                    required
                    min="1"
                    placeholder="Ej. 480"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <PhoneCall size={14} className="text-blue-400" />
                Llamadas Atendidas (Opcional)
              </label>
              <input 
                type="number" 
                name="calls"
                placeholder="Ej. 15"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare size={14} className="text-blue-400" />
                Observaciones
              </label>
              <textarea 
                name="observations"
                rows={4}
                placeholder="Detalles adicionales sobre la sesión..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3 disabled:opacity-50 group"
            >
              {isLoading ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={24} className="group-hover:scale-110 transition-transform" />
                  Guardar Registro de Producción
                </>
              )}
            </button>
          </form>
        )}
      </div>
      
      <p className="text-center text-slate-600 text-sm mt-8">
        Todos los registros manuales están sujetos a verificación por el departamento administrativo.
      </p>
    </div>
  );
}
