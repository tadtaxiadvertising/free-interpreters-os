import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

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

function validateAudioFile(file: File): { valid: boolean; error?: string } {
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
  return { valid: true };
}

function normalizeMimeType(mime: string): string {
  if (mime.startsWith('audio/webm')) return 'audio/webm';
  if (mime.startsWith('audio/mp4')) return 'audio/mp4';
  if (mime.startsWith('audio/ogg')) return 'audio/ogg';
  if (mime.startsWith('audio/mpeg')) return 'audio/mpeg';
  return mime;
}

async function convertToMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath!, [
      '-i', inputPath,
      '-vn',
      '-ar', '44100',
      '-ac', '2',
      '-b:a', '128k',
      '-f', 'mp3',
      outputPath,
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`FFmpeg error: ${err.message}`));
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as File;
    const sessionId = formData.get('sessionId') as string;
    const scenarioId = formData.get('scenarioId') as string;

    if (!file || !sessionId || !scenarioId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const validation = validateAudioFile(file);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    // Upload original WebM to Supabase
    const webmExt = file.type.includes('webm') ? 'webm' : 'webm';
    const webmPath = `responses/${sessionId}/${scenarioId}.${webmExt}`;
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(webmPath, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      return NextResponse.json({ success: false, error: 'Failed to upload original audio' }, { status: 500 });
    }

    // Convert to MP3
    const tempDir = tmpdir();
    const inputPath = join(tempDir, `${scenarioId}_input.webm`);
    const outputPath = join(tempDir, `${scenarioId}_output.mp3`);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    try {
      await convertToMp3(inputPath, outputPath);
    } catch (err) {
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
      return NextResponse.json({ success: false, error: `Audio conversion failed: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 500 });
    }

    // Read converted MP3
    const mp3Buffer = await readFile(outputPath);
    
    // Upload MP3 to Supabase
    const mp3Path = `responses/${sessionId}/${scenarioId}.mp3`;
    const { error: mp3UploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(mp3Path, mp3Buffer, { contentType: 'audio/mpeg', upsert: true });

    // Cleanup temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    if (mp3UploadError) {
      return NextResponse.json({ success: false, error: 'Failed to upload converted audio' }, { status: 500 });
    }

    // Get signed URL for the MP3
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(mp3Path, 60 * 60 * 24 * 365); // 1 year

    if (!signedUrlData?.signedUrl) {
      return NextResponse.json({ success: false, error: 'Failed to create signed URL' }, { status: 500 });
    }
    const signedUrl = signedUrlData.signedUrl;

    // Delete the original WebM file (optional - keep both or remove)
    await supabaseAdmin.storage.from(BUCKET).remove([webmPath]);

    return NextResponse.json({ 
      success: true, 
      data: { 
        mp3Url: signedUrl,
        mp3Path,
        originalPath: webmPath,
      } 
    });
  } catch (error) {
    console.error('Audio conversion error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

// Helper to read file
async function readFile(path: string): Promise<Buffer> {
  const { readFile } = await import('fs/promises');
  return readFile(path);
}