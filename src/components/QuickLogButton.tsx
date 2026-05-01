'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Clock, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export function QuickLogButton({ inline = false }: { inline?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [duration, setDuration] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duration || isNaN(Number(duration))) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/calls/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: duration }),
      });
      
      if (!response.ok) throw new Error('Failed to save log');
      
      setIsOpen(false);
      setDuration('');
      router.refresh(); // Refresh the server component data
    } catch (error) {
      console.error('Error logging call:', error);
      alert('Error saving manual log. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all group",
          inline
            ? "px-8 py-4 rounded-2xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30"
            : "fixed bottom-8 right-8 z-50 px-5 py-3 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_25px_rgba(79,70,229,0.6)] hover:-translate-y-1"
        )}
      >
        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
        <span className={inline ? "" : "hidden md:inline"}>Registro Rápido</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
            
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-white mb-1">Log Missing Call</h3>
            <p className="text-sm text-slate-400 mb-6">Enter the duration of the manual call in minutes.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-slate-300 mb-2">
                  Duration (Minutes)
                </label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    id="duration"
                    type="number"
                    min="1"
                    required
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !duration}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold transition-all",
                  isSubmitting || !duration 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                )}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={18} />
                    Submit Log
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
