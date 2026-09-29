import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase configuration missing for Roleplay');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BUCKET = 'roleplay-audio';
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME_TYPES = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/webm;codecs=pcm',
  'audio/mp4',
  'audio/ogg',
  'audio/mpeg',
];

const DURATION_LIMIT_SECONDS = 300; // 5 minutes

export interface SignedUploadResponse {
  uploadUrl: string;
  token: string;
  path: string;
  expiresIn: number;
}

export interface AudioValidationResult {
  valid: boolean;
  normalizedMime?: string;
  extension?: string;
  error?: string;
}

export function validateAudioFile(file: File): AudioValidationResult {
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File exceeds 15 MB limit' };
  }

  const normalizedMime = normalizeMimeType(file.type);
  if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    return { valid: false, error: `MIME type ${file.type} not allowed` };
  }

  const extension = mimeToExtension(normalizedMime);
  return { valid: true, normalizedMime, extension };
}

function normalizeMimeType(mime: string): string {
  if (mime.startsWith('audio/webm')) return 'audio/webm';
  if (mime.startsWith('audio/mp4')) return 'audio/mp4';
  if (mime.startsWith('audio/ogg')) return 'audio/ogg';
  if (mime.startsWith('audio/mpeg')) return 'audio/mpeg';
  return mime;
}

function mimeToExtension(mime: string): string {
  switch (mime) {
    case 'audio/webm': return 'webm';
    case 'audio/mp4': return 'mp4';
    case 'audio/ogg': return 'ogg';
    case 'audio/mpeg': return 'mp3';
    default: return 'webm';
  }
}

export function getBaseAudioPath(sessionId: string, extension: string): string {
  return `base/${sessionId}.${extension}`;
}

export function getResponseAudioPath(sessionId: string, extension: string): string {
  return `responses/${sessionId}/${randomUUID()}.${extension}`;
}

export async function createSignedUploadUrl(
  sessionId: string,
  mimeType: string,
  isBaseAudio: boolean = false
): Promise<SignedUploadResponse> {
  const validation = validateAudioFile(new File([], 'test', { type: mimeType }));
  if (!validation.valid || !validation.extension) {
    throw new Error(validation.error || 'Invalid MIME type');
  }

  const path = isBaseAudio
    ? getBaseAudioPath(sessionId, validation.extension)
    : getResponseAudioPath(sessionId, validation.extension);

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) {
    throw new Error(`Failed to create signed upload URL: ${error.message}`);
  }

  return {
    uploadUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    expiresIn: 60 * 60, // 1 hour
  };
}

export async function confirmUpload(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

export async function deleteAudio(path: string): Promise<void> {
  await supabaseAdmin.storage.from(BUCKET).remove([path]);
}

export async function getSignedAudioUrl(path: string, expiresIn: number = 60 * 60): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
  return data.signedUrl;
}

export function getDurationLimit(): number {
  return DURATION_LIMIT_SECONDS;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}