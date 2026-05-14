'use client';

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CSVImporterProps {
  type: 'interpreters' | 'production' | 'qa';
  title: string;
  description: string;
}

export function CSVImporter({ type, title, description }: CSVImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{ successCount: number; errorCount: number; errors: string[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const response = await fetch('/api/import/csv', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setStatus('success');
        setResult(data);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="glass p-8 rounded-3xl border border-white/5 space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>

      <div className={cn(
        "relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all",
        status === 'success' ? "border-green-500/50 bg-green-500/5" :
        status === 'error' ? "border-red-500/50 bg-red-500/5" :
        "border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5"
      )}>
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        
        {status === 'success' ? (
          <CheckCircle2 size={48} className="text-green-400 mb-4 animate-in zoom-in duration-300" />
        ) : status === 'error' ? (
          <AlertCircle size={48} className="text-red-400 mb-4 animate-in zoom-in duration-300" />
        ) : (
          <Upload size={48} className="text-blue-400 mb-4 opacity-50 group-hover:opacity-100 transition-opacity" />
        )}

        <p className="text-white font-medium">
          {file ? file.name : "Click or drag CSV file to upload"}
        </p>
        <p className="text-xs text-gray-500 mt-1">Maximum file size: 10MB</p>
      </div>

      {result && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Imported Successfully:</span>
            <span className="text-green-400 font-bold">{result.successCount}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Errors encountered:</span>
            <span className="text-red-400 font-bold">{result.errorCount}</span>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <p className="text-[10px] text-gray-500 mb-1 uppercase font-bold tracking-widest">Error Preview:</p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-[10px] text-red-400/70 truncate">• {err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || status === 'uploading'}
        className={cn(
          "w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
          !file || status === 'uploading' 
            ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
            : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
        )}
      >
        {status === 'uploading' ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <FileText size={20} />
        )}
        {status === 'uploading' ? "Processing..." : "Process Import"}
      </button>
    </div>
  );
}
