'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Mic, MicOff, Play, Pause, Square, CheckCircle2, AlertCircle, Loader2, 
  Volume2, VolumeX, Trash2, RotateCcw, Send, Clock, Headphones
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { submitRoleplayResponse, confirmRoleplayResponse } from '@/app/actions/roleplay';

type RecordingState = 'ready' | 'recording' | 'review' | 'uploading' | 'complete';

export default function RoleplayRoomPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [state, setState] = useState<RecordingState>('ready');
  const [baseAudioUrl, setBaseAudioUrl] = useState<string>('');
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const baseAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scenarioIndexRef = useRef(0);

  // Fetch session data on mount
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/roleplay/session/${sessionId}`);
        const data = await res.json();
        if (data.success && data.data.baseAudioUrl) {
          setBaseAudioUrl(data.data.baseAudioUrl);
        } else {
          setError(data.error || 'Failed to load session');
        }
      } catch {
        setError('Failed to load session');
      }
    }
    fetchSession();
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, [recordingUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const startTimer = useCallback(() => {
    setDuration(0);
    timerIntervalRef.current = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const handleStartRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordingBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        setState('review');
      };

      recorder.start(100);
      startTimer();
      setState('recording');
    } catch (err) {
      setError('Microphone access denied. Please allow microphone permission.');
      console.error(err);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      stopTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }
  };

  const handlePlayPauseBase = () => {
    if (!baseAudioRef.current) return;
    if (baseAudioRef.current.paused) {
      baseAudioRef.current.play();
    } else {
      baseAudioRef.current.pause();
    }
  };

  const handlePlayPausePreview = () => {
    if (!previewAudioRef.current || !recordingUrl) return;
    if (previewAudioRef.current.paused) {
      previewAudioRef.current.play();
    } else {
      previewAudioRef.current.pause();
    }
  };

  const handleReRecord = () => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingBlob(null);
    setRecordingUrl('');
    setDuration(0);
    setState('ready');
  };

  const handleSubmit = async () => {
    if (!recordingBlob) return;

    setState('uploading');
    setIsLoading(true);
    setError(null);

    try {
      const submitResult = await submitRoleplayResponse({
        sessionId,
      });

      if (!submitResult.success || !submitResult.data) throw new Error(submitResult.error);

      const { sessionId: submittedSessionId, scenarioId, convertApiUrl } = submitResult.data;

      // Upload to conversion API (handles WebM -> MP3 conversion)
      const formData = new FormData();
      formData.append('audio', recordingBlob);
      formData.append('sessionId', submittedSessionId);
      formData.append('scenarioId', `scenario_${scenarioIndexRef.current}`);

      const convertRes = await fetch(convertApiUrl, {
        method: 'POST',
        body: formData,
      });

      const convertResult = await convertRes.json();

      if (!convertResult.success) throw new Error(convertResult.error || 'Conversion failed');

      // Confirm the MP3 upload
      const confirmResult = await confirmRoleplayResponse({
        sessionId: submittedSessionId,
        scenarioId: `scenario_${scenarioIndexRef.current}`,
        recordedAudioUrl: convertResult.data.mp3Url,
      });

      if (!confirmResult.success) throw new Error(confirmResult.error);

      setState('complete');
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      setState('review');
      setIsLoading(false);
    }
  };

  // State 1: Ready
  if (state === 'ready') {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="glass p-8 rounded-3xl border border-white/5">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mic2 size={40} className="text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Roleplay Session</h1>
              <p className="text-gray-400">Listen to the base audio, then record your response</p>
            </div>

            <div className="space-y-6">
              <div className="glass p-6 rounded-2xl border border-white/5 bg-slate-900/40">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Headphones className="text-blue-400" />
                  Base Audio
                </h3>
                <audio 
                  ref={baseAudioRef} 
                  src={baseAudioUrl} 
                  controls 
                  className="w-full"
                />
              </div>

              <button 
                onClick={handleStartRecording}
                disabled={!baseAudioUrl || isLoading}
                className={cn(
                  "w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3",
                  !baseAudioUrl || isLoading
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20"
                )}
              >
                <Mic size={24} />
                Start Recording Response
              </button>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
                  <AlertCircle />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Recording
  if (state === 'recording') {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="glass p-8 rounded-3xl border border-white/5 text-center">
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <div className="w-8 h-8 bg-red-500 rounded-full" />
            </div>
            <div className="text-6xl font-mono font-bold text-white mb-2" style={{ fontFamily: 'monospace' }}>
              {formatTime(duration)}
            </div>
            <p className="text-gray-400 mb-8">Recording in progress...</p>
            
            <button 
              onClick={handleStopRecording}
              className="w-full max-w-xs mx-auto py-4 rounded-xl font-bold text-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors flex items-center justify-center gap-3"
            >
              <Square size={24} />
              Stop Recording
            </button>

            {error && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // State 3: Review
  if (state === 'review') {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="glass p-8 rounded-3xl border border-white/5">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={40} className="text-green-400" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Review Your Response</h1>
              <p className="text-gray-400">Listen to your recording before submitting</p>
            </div>

            <div className="space-y-6">
              <div className="glass p-6 rounded-2xl border border-white/5 bg-slate-900/40">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Mic className="text-green-400" />
                  Your Response
                </h3>
                <audio 
                  ref={previewAudioRef} 
                  src={recordingUrl} 
                  controls 
                  className="w-full"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleReRecord}
                  className="flex-1 py-4 rounded-xl font-bold border border-white/10 text-gray-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw size={20} />
                  Re-record
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: isLoading ? '#1e293b' : '#dc2626', opacity: isLoading ? 0.5 : 1 }}
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  Submit Response
                </button>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
                  <AlertCircle />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 4: Uploading
  if (state === 'uploading') {
    return (
      <div className="min-h-screen bg-slate-950 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="glass p-8 rounded-3xl border border-white/5 text-center">
            <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Loader2 size={40} className="animate-spin text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Submitting Response</h1>
            <p className="text-gray-400 mb-8">Please wait while we upload your recording...</p>
            
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full animate-pulse" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 5: Complete
  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="glass p-8 rounded-3xl border border-white/5 text-center">
          <div className="w-20 h-20 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Response Submitted!</h1>
          <p className="text-gray-400 mb-8">Your response has been submitted and is now awaiting evaluation.</p>
          
          <button 
            onClick={() => router.push('/dashboard/roleplays')}
            className="w-full max-w-xs mx-auto py-4 rounded-xl font-bold bg-green-600 hover:bg-green-500 text-white transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={20} />
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// Need to import Mic2
import { Mic2 } from 'lucide-react';