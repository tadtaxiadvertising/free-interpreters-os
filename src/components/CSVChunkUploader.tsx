'use client';

import React, { useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadLogChunk } from '@/app/actions/production.actions';

function SubmitButton({ progress }: { progress: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
        pending
          ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
          : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
      )}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" size={20} />
          {progress > 0 ? `Procesando... ${progress}%` : "Iniciando..."}
        </>
      ) : (
        <>
          <FileText size={20} />
          Procesar CSV
        </>
      )}
    </button>
  );
}

export function CSVChunkUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  const processFile = async (prevState: any, formData: FormData) => {
    const uploadedFile = formData.get('file') as File;
    if (!uploadedFile || uploadedFile.size === 0) {
      return { success: false, error: 'No se seleccionó un archivo válido.' };
    }

    try {
      const text = await uploadedFile.text();
      const lines = text.split('\n').filter(l => l.trim() !== '');
      if (lines.length < 2) return { success: false, error: 'CSV vacío o sin suficientes datos' };

      const headers = lines[0];
      const dataLines = lines.slice(1);
      const chunkSize = 500; // Límite conservador para $0 Budget VPS
      let totalSuccess = 0;

      setProgress(1);

      for (let i = 0; i < dataLines.length; i += chunkSize) {
        const chunk = dataLines.slice(i, i + chunkSize);
        const res = await uploadLogChunk(null, { headers, rows: chunk });
        
        if (res.success) {
          totalSuccess += res.count || 0;
        } else {
          console.error('[CSV Uploader] Chunk Error:', res.error);
        }
        
        setProgress(Math.round(((i + chunk.length) / dataLines.length) * 100));
      }

      setProgress(0);
      setFile(null); // Resetea el archivo visualmente
      return { success: true, count: totalSuccess, error: null };
    } catch (error: any) {
      setProgress(0);
      return { success: false, error: error.message || 'Error catastrofico procesando el archivo' };
    }
  };

  const [state, formAction] = useActionState(processFile, null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="glass p-8 rounded-3xl border border-white/5 space-y-6 bg-slate-900/40">
      <div>
        <h3 className="text-xl font-bold text-white">Telemetría (Carga Masiva)</h3>
        <p className="text-sm text-gray-400 mt-1">Sube CSVs pesados. Se fraccionan localmente (Chunks de 500) para evadir Timeouts en Easypanel.</p>
      </div>

      <form action={formAction} className="space-y-6">
        <div className={cn(
          "relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all",
          state?.success ? "border-green-500/50 bg-green-500/5" :
          state?.error ? "border-red-500/50 bg-red-500/5" :
          "border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5"
        )}>
          <input 
            type="file" 
            name="file"
            accept=".csv" 
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            required
          />
          
          {state?.success ? (
            <CheckCircle2 size={48} className="text-green-400 mb-4 animate-in zoom-in duration-300" />
          ) : state?.error ? (
            <AlertCircle size={48} className="text-red-400 mb-4 animate-in zoom-in duration-300" />
          ) : (
            <Upload size={48} className="text-blue-400 mb-4 opacity-50 transition-opacity" />
          )}

          <p className="text-white font-medium text-center">
            {file ? file.name : "Click o arrastra un CSV (Logs/Metrics)"}
          </p>
          <p className="text-xs text-gray-500 mt-1">Carga asíncrona segura.</p>
        </div>

        {state && (
          <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
             {state.success ? (
                <div className="flex justify-between text-xs text-green-400">
                  <span>Filas impactadas en BD:</span>
                  <span className="font-bold">{state.count}</span>
                </div>
             ) : (
                <div className="flex justify-between text-xs text-red-400">
                  <span>Error:</span>
                  <span className="font-bold">{state.error}</span>
                </div>
             )}
          </div>
        )}

        <SubmitButton progress={progress} />
      </form>
    </div>
  );
}
