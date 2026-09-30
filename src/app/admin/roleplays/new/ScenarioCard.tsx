'use client';

import React, { useState, useRef } from 'react';
import { 
  Mic2, 
  Loader2, 
  AlertCircle, 
  Trash2, 
  GripVertical, 
  Clock,
  FileText,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Scenario {
  id: string;
  title: string;
  baseAudioFile: File | null;
  baseAudioPreview: string;
  durationLimitSec: number;
  scriptPrompt: string;
}

interface ScenarioCardProps {
  scenario: Scenario;
  index: number;
  onUpdate: (id: string, updates: Partial<Scenario>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isDragging: boolean;
}

export function ScenarioCard({ 
  scenario, 
  index, 
  onUpdate, 
  onRemove, 
  onMoveUp, 
  onMoveDown, 
  isDragging 
}: ScenarioCardProps) {
  const [baseAudioPreview, setBaseAudioPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        alert('File must be less than 15 MB');
        return;
      }
      const validTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'];
      if (!validTypes.some(t => file.type.startsWith(t))) {
        alert('Invalid audio format. Use webm, mp4, ogg, or mp3');
        return;
      }
      onUpdate(scenario.id, { 
        baseAudioFile: file, 
        baseAudioPreview: URL.createObjectURL(file) 
      });
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(scenario.id, { title: e.target.value });
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    onUpdate(scenario.id, { durationLimitSec: value });
  };

  const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(scenario.id, { scriptPrompt: e.target.value });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'No limit';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={cn(
        "glass p-6 rounded-2xl border border-white/5 transition-all duration-300",
        isDragging && "opacity-50 ring-2 ring-blue-500/50"
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-1">
          <button
            className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              e.preventDefault();
              // Drag start handled by parent
            }}
            aria-label="Drag to reorder"
          >
            <GripVertical size={20} className="text-gray-500" />
          </button>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={scenario.title || `Scenario ${index + 1}`}
              onChange={handleTitleChange}
              placeholder={`Scenario ${index + 1} title`}
              className="bg-transparent border-none text-white placeholder-gray-500 text-lg font-semibold focus:outline-none w-full"
            />
            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {scenario.durationLimitSec ? `${Math.floor(scenario.durationLimitSec / 60)}:${(scenario.durationLimitSec % 60).toString().padStart(2, '0')}` : 'No limit'}
              </span>
              {scenario.baseAudioFile && (
                <span className="flex items-center gap-1 text-green-400">
                  <Mic2 size={12} />
                  Audio ready
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => onRemove(scenario.id)}
          className="p-2 hover:bg-red-500/20 rounded-xl text-red-400 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Remove scenario"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Duration Limit (seconds)</label>
            <input
              type="number"
              value={scenario.durationLimitSec || ''}
              onChange={handleDurationChange}
              placeholder="e.g., 120"
              min="0"
              className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-white focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Script Prompt (optional)</label>
            <textarea
              value={scenario.scriptPrompt}
              onChange={handleScriptChange}
              placeholder="Key phrases or guidance for the interpreter..."
              rows={2}
              className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-white focus:border-blue-500 transition-colors resize-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Base Audio</label>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 15 * 1024 * 1024) {
                    alert('File must be less than 15 MB');
                    return;
                  }
                  const validTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'];
                  if (!validTypes.some(t => file.type.startsWith(t))) {
                    alert('Invalid audio format. Use webm, mp4, ogg, or mp3');
                    return;
                  }
                  const preview = URL.createObjectURL(file);
                  onUpdate(scenario.id, { baseAudioFile: e.target.files![0], baseAudioPreview: preview });
                }
              }}
            className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-white focus:border-blue-500 transition-colors file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-500"
            />
            {scenario.baseAudioPreview && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400">Preview:</p>
                <audio src={scenario.baseAudioPreview} controls className="w-full" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}