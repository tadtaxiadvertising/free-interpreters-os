'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mic2, Loader2, User, UserPlus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Participant {
  id: number;
  name: string;
  email?: string;
  externalId?: string;
  emailCorporativo?: string;
}

interface NewRoleplayFormProps {
  interpreters: Participant[];
  candidates: Participant[];
}

export default function NewRoleplayForm({ interpreters, candidates }: NewRoleplayFormProps) {
  const [participantType, setParticipantType] = useState<'interpreter' | 'candidate'>('interpreter');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [baseAudioFile, setBaseAudioFile] = useState<File | null>(null);
  const [baseAudioPreview, setBaseAudioPreview] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ link: string; participantName: string } | null>(null);

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        setError('File must be less than 15 MB');
        return;
      }
      const validTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'];
      if (!validTypes.some(t => file.type.startsWith(t))) {
        setError('Invalid audio format. Use webm, mp4, ogg, or mp3');
        return;
      }
      setBaseAudioFile(file);
      setBaseAudioPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleCreate = async () => {
    if (!baseAudioFile) {
      setError('Please select a base audio file');
      return;
    }
    if (!selectedParticipantId) {
      setError('Please select a participant');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('baseAudio', baseAudioFile);
      formData.append('participantType', participantType);
      formData.append('participantId', selectedParticipantId);

      const res = await fetch('/api/admin/roleplays', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Failed to create roleplay');

      setSuccess({ 
        link: data.data.inviteLink || `${window.location.origin}/roleplays/${data.data.sessionId}`,
        participantName: participantType === 'interpreter' 
          ? interpreters.find(i => i.id === parseInt(selectedParticipantId))?.name || 'Interpreter'
          : candidates.find(c => c.id === parseInt(selectedParticipantId))?.name || 'Candidate',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create roleplay');
    } finally {
      setIsCreating(false);
    }
  };

  const participants = participantType === 'interpreter' ? interpreters : candidates;

  if (success) {
    return (
      <div className="glass p-8 rounded-3xl border border-white/5 text-center animate-in fade-in">
        <div className="w-20 h-20 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Mic2 size={40} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Roleplay Created!</h2>
        <p className="text-gray-400 mb-6">
          Session created for <span className="font-bold text-white">{success.participantName}</span>
        </p>
        <div className="mb-6 p-4 bg-slate-900/50 rounded-xl">
          <input 
            type="text" 
            value={success.link} 
            readOnly
            className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white text-sm text-center"
          />
        </div>
        <div className="flex gap-4 justify-center">
          <button 
            onClick={() => navigator.clipboard.writeText(success.link)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
          >
            Copy Link
          </button>
          <Link 
            href="/admin/roleplays"
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors"
          >
            View All Roleplays
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-8 rounded-3xl border border-white/5 space-y-8">
      <div>
        <h3 className="text-lg font-bold text-white mb-4">Participant Type</h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => { setParticipantType('interpreter'); setSelectedParticipantId(''); setError(null); }}
            className={cn(
              "p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3",
              participantType === 'interpreter'
                ? "border-blue-500 bg-blue-500/10"
                : "border-white/10 hover:border-white/20"
            )}
          >
            <User size={24} className={cn(participantType === 'interpreter' ? 'text-blue-400' : 'text-gray-400')} />
            <span className={cn(participantType === 'interpreter' ? 'text-blue-400' : 'text-gray-300')}>
              Interpreter
            </span>
          </button>
          <button
            onClick={() => { setParticipantType('candidate'); setSelectedParticipantId(''); setError(null); }}
            className={cn(
              "p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3",
              participantType === 'candidate'
                ? "border-green-500 bg-green-500/10"
                : "border-white/10 hover:border-white/20"
            )}
          >
            <UserPlus size={24} className={cn(participantType === 'candidate' ? 'text-green-400' : 'text-gray-400')} />
            <span className={cn(participantType === 'candidate' ? 'text-green-400' : 'text-gray-300')}>
              Candidate
            </span>
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-white mb-4">Select Participant</h3>
        <select
          value={selectedParticipantId}
          onChange={(e) => setSelectedParticipantId(e.target.value)}
          className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 transition-colors"
        >
          <option value="">Choose a {participantType}...</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email || p.externalId || p.emailCorporativo})
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-lg font-bold text-white mb-4">Base Audio</h3>
        <div className="space-y-4">
          <input
            type="file"
            accept="audio/*"
            onChange={handleAudioSelect}
            className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-500"
          />
          {baseAudioPreview && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-300">Preview:</p>
              <audio src={baseAudioPreview} controls className="w-full" />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
          <AlertCircle />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={isCreating || !baseAudioFile || !selectedParticipantId}
        className={cn(
          "w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3",
          isCreating || !baseAudioFile || !selectedParticipantId
            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
            : "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20"
        )}
      >
        {isCreating ? <><Loader2 className="animate-spin" size={24} /> Creating...</> : <><Mic2 size={24} /> Create Roleplay</>}
      </button>
    </div>
  );
}