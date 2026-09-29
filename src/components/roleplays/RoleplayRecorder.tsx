'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, CheckCircle2, Loader2, Mic, Send, Square } from 'lucide-react';
import { confirmRoleplayUpload, requestRoleplayUpload } from '@/app/actions/roleplays';
import { createClient } from '@/lib/supabase/client';
import { MAX_ROLEPLAY_DURATION_SECONDS } from '@/lib/roleplay';

type Props = { sessionId: string; baseAudioUrl: string };

function SendButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending} className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700">
    {pending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} {pending ? 'Enviando…' : 'Enviar respuesta'}
  </button>;
}

export function RoleplayRecorder({ sessionId, baseAudioUrl }: Props) {
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setElapsed((time) => {
      if (time + 1 >= MAX_ROLEPLAY_DURATION_SECONDS) recorder.current?.stop();
      return time + 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(MediaRecorder.isTypeSupported);
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        const file = new File([blob], `roleplay-${sessionId}.webm`, { type: blob.type || 'audio/webm' });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudio(file); setAudioUrl(URL.createObjectURL(blob)); setRecording(false);
      };
      recorder.current = mediaRecorder;
      setElapsed(0); mediaRecorder.start(250); setRecording(true);
    } catch {
      setError('No pudimos acceder al micrófono. Verifica los permisos del navegador e inténtalo de nuevo.');
    }
  };

  const stopRecording = () => recorder.current?.state === 'recording' && recorder.current.stop();
  const submit = (formData: FormData) => {
    startTransition(async () => {
      if (!audio) return;
      const prepared = await requestRoleplayUpload(sessionId, { size: audio.size, type: audio.type });
      if (!prepared.success || !prepared.path || !prepared.token) { setError(prepared.error ?? 'No se pudo preparar la carga.'); return; }
      const client = createClient();
      if (!client) { setError('La configuración de Storage no está disponible.'); return; }
      const { error: uploadError } = await client.storage.from('roleplay-audio').uploadToSignedUrl(prepared.path, prepared.token, audio, { contentType: audio.type });
      if (uploadError) { setError('No se pudo subir el audio.'); return; }
      const result = await confirmRoleplayUpload(sessionId, prepared.path);
      if (result.success) setSent(true); else setError(result.error ?? 'No se pudo enviar el audio.');
    });
  };
  const timestamp = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return <section className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur md:p-10">
    <header className="text-center"><p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-300">Sala de práctica</p><h1 className="mt-2 text-3xl font-bold text-white">Roleplay de interpretación</h1><p className="mt-2 text-slate-400">Escucha el audio base y graba tu intervención sin interrupciones.</p></header>
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5"><p className="mb-3 text-sm font-semibold text-slate-300">Audio base</p><audio controls preload="metadata" className="w-full" src={baseAudioUrl}>Tu navegador no soporta audio.</audio></div>
    <div className={`rounded-2xl border p-6 text-center ${recording ? 'border-red-400/60 bg-red-500/10' : 'border-white/10 bg-slate-900/60'}`}>
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">{recording ? <span className="h-5 w-5 animate-pulse rounded-full bg-red-500" /> : <Mic className="text-blue-300" />}</div>
      <p className="font-mono text-3xl font-bold text-white">{timestamp}</p><p className="mt-1 text-sm font-medium text-slate-400">{recording ? 'Grabando — tu micrófono está activo' : audio ? 'Grabación lista para revisar' : 'Listo para comenzar'}</p>
      <button type="button" onClick={recording ? stopRecording : startRecording} disabled={isPending || sent} className={`mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold text-white disabled:cursor-not-allowed ${recording ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>{recording ? <><Square size={18} /> Detener grabación</> : <><Mic size={18} /> Grabar respuesta</>}</button>
    </div>
    {audioUrl && <div className="rounded-2xl border border-white/10 bg-slate-900 p-5"><p className="mb-3 text-sm font-semibold text-slate-300">Revisa tu respuesta</p><audio controls className="w-full" src={audioUrl} /></div>}
    {error && <p role="alert" className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"><AlertCircle size={18} />{error}</p>}
    {sent ? <p className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 font-semibold text-emerald-200"><CheckCircle2 size={18} />Enviado. Tu respuesta quedó disponible para evaluación.</p> : <form action={submit} className="flex justify-center"><input type="hidden" name="sessionId" value={sessionId} /><SendButton disabled={!audio || recording || isPending} /></form>}
  </section>;
}
