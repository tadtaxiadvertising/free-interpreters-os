'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertTriangle } from 'lucide-react';

interface ScorecardFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  preselectedInterpreterId?: number;
}

export function ScorecardForm({ onSuccess, onCancel, preselectedInterpreterId }: ScorecardFormProps) {
  const [loading, setLoading] = useState(false);
  const [interpreters, setInterpreters] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [scores, setScores] = useState({
    protocol: 20,
    interpretation: 40,
    language: 20,
    service: 10,
    technical: 10
  });
  
  const [criticalError, setCriticalError] = useState(false);

  useEffect(() => {
    async function fetchInterpreters() {
      try {
        // Use relative URL for client-side and robust SSR
        const res = await fetch('/api/interpreters');
        if (res.ok) {
          const data = await res.json();
          setInterpreters(data);
        }
      } catch (err) {
        console.error('Error fetching interpreters:', err);
      }
    }
    fetchInterpreters();
  }, []);

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      interpreterId: preselectedInterpreterId || parseInt(formData.get('interpreterId') as string),
      auditDate: new Date().toISOString(),
      auditor: 'Admin', // In real case, from session
      protocolScore: scores.protocol,
      interpretationScore: scores.interpretation,
      languageScore: scores.language,
      serviceScore: scores.service,
      technicalScore: scores.technical,
      totalScore: totalScore,
      criticalError: criticalError,
      comentarios: formData.get('comentarios'),
      accionRequerida: formData.get('accionRequerida'),
      productionLogId: 1, // Placeholder until linked to actual logs
    };

    try {
      const response = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit scorecard');
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

      {!preselectedInterpreterId && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Interpreter</label>
          <select
            required
            name="interpreterId"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors appearance-none"
          >
            <option value="">Select Interpreter</option>
            {interpreters.map(i => (
              <option key={i.id} value={i.id}>{i.name} ({i.externalId})</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { key: 'protocol', label: 'Protocol', max: 20 },
          { key: 'interpretation', label: 'Interp.', max: 40 },
          { key: 'language', label: 'Language', max: 20 },
          { key: 'service', label: 'Service', max: 10 },
          { key: 'technical', label: 'Tech', max: 10 },
        ].map((field) => (
          <div key={field.key} className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block truncate">{field.label} ({field.max})</label>
            <input
              type="number"
              max={field.max}
              min={0}
              value={(scores as any)[field.key]}
              onChange={(e) => setScores({ ...scores, [field.key]: parseInt(e.target.value) || 0 })}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-center font-bold"
            />
          </div>
        ))}
      </div>

      <div className="p-6 rounded-3xl bg-white/5 border border-white/5 flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-500">Calculated Score</p>
          <h3 className={`text-3xl font-black ${totalScore >= 90 ? 'text-green-400' : totalScore >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
            {totalScore}%
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-3 cursor-pointer group">
            <span className="text-sm font-bold text-gray-400 group-hover:text-red-400 transition-colors">Critical Error</span>
            <div 
              onClick={() => setCriticalError(!criticalError)}
              className={`w-12 h-6 rounded-full transition-all relative ${criticalError ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-white/10'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${criticalError ? 'left-7' : 'left-1'}`} />
            </div>
          </label>
          {criticalError && <AlertTriangle size={24} className="text-red-500 animate-pulse" />}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Comments & Observations</label>
        <textarea
          name="comentarios"
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors resize-none"
          placeholder="Enter audit details..."
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Required Action</label>
        <select
          name="accionRequerida"
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:border-blue-500/50 transition-colors appearance-none"
        >
          <option value="Ninguna">None (Passed)</option>
          <option value="Coaching">Coaching Needed</option>
          <option value="Advertencia">Formal Warning</option>
        </select>
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
          Submit Scorecard
        </button>
      </div>
    </form>
  );
}
