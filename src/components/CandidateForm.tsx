'use client';

import React, { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';

interface CandidateFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CandidateForm({ onSuccess, onCancel }: CandidateFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      telefono: formData.get('telefono'),
      pais: formData.get('pais'),
      fuente: formData.get('fuente'),
      englishLevel: formData.get('englishLevel'),
      speedtestMbps: parseInt(formData.get('speedtestMbps') as string) || 0,
      fechaPostulacion: new Date().toISOString(),
      status: 'Aplicante',
    };

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/recruitment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create candidate');
      }

      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Full Name</label>
          <input
            required
            name="name"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors"
            placeholder="Applicant Name"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
          <input
            required
            type="email"
            name="email"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors"
            placeholder="email@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Phone / WhatsApp</label>
          <input
            name="telefono"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors"
            placeholder="+1 234 567 890"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Country</label>
          <input
            name="pais"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors"
            placeholder="Dominican Republic"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Source</label>
          <select
            name="fuente"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors appearance-none"
          >
            <option value="LinkedIn">LinkedIn</option>
            <option value="Facebook">Facebook</option>
            <option value="Referido">Referido</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">English Level</label>
          <select
            name="englishLevel"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors appearance-none"
          >
            <option value="B2">B2 (Upper Intermediate)</option>
            <option value="C1">C1 (Advanced)</option>
            <option value="C2">C2 (Proficient)</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Speedtest (Mbps)</label>
          <input
            type="number"
            name="speedtestMbps"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors"
            placeholder="50"
          />
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 rounded-2xl font-bold transition-all border border-white/10"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all glow flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          Register Candidate
        </button>
      </div>
    </form>
  );
}
