'use client';

import React, { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';

interface InterpreterFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function InterpreterForm({ onSuccess, onCancel }: InterpreterFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      externalId: formData.get('externalId'),
      emailCorporativo: formData.get('emailCorporativo'),
      tariffPerMinute: parseFloat(formData.get('tariffPerMinute') as string),
      status: formData.get('status'),
      campaign: formData.get('campaign'),
    };

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/interpreters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create interpreter');
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
            placeholder="Jane Doe"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">External ID</label>
          <input
            required
            name="externalId"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors"
            placeholder="INT-001"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Corporate Email</label>
        <input
          type="email"
          name="emailCorporativo"
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors"
          placeholder="jane@freeinterpreters.com"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Tariff per Minute ($)</label>
          <input
            required
            type="number"
            step="0.01"
            name="tariffPerMinute"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors"
            placeholder="0.15"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Initial Status</label>
          <select
            name="status"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors appearance-none"
          >
            <option value="Activo">Activo</option>
            <option value="Training">Training</option>
            <option value="Probation">Probation</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Assigned Campaign</label>
        <input
          name="campaign"
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors"
          placeholder="HealthCare"
        />
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
          Save Interpreter
        </button>
      </div>
    </form>
  );
}
