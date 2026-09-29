import { z } from 'zod';

export const ROLEPLAY_AUDIO_BUCKET = 'roleplay-audio';
export const MAX_ROLEPLAY_AUDIO_BYTES = 15 * 1024 * 1024;
export const MAX_ROLEPLAY_DURATION_SECONDS = 300;
export const ROLEPLAY_AUDIO_MIME_TYPES = ['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg'] as const;

export const RoleplayAudioSchema = z
  .instanceof(File, { message: 'Debes adjuntar un archivo de audio.' })
  .refine((file) => file.size > 0, 'El archivo de audio está vacío.')
  .refine((file) => file.size <= MAX_ROLEPLAY_AUDIO_BYTES, 'El audio no puede superar 15 MB.')
  .refine(
    (file) => ROLEPLAY_AUDIO_MIME_TYPES.includes(file.type.split(';')[0] as (typeof ROLEPLAY_AUDIO_MIME_TYPES)[number]),
    'Formato no permitido. Usa WebM, MP3, MP4 o OGG.',
  );

export const RoleplaySubmissionSchema = z.object({
  sessionId: z.string().min(1, 'Sesión de roleplay inválida.'),
  audio: RoleplayAudioSchema,
});

export const CreateRoleplaySessionSchema = z.object({
  interpreterId: z.coerce.number().int().positive().optional(),
  recruitmentCandidateId: z.coerce.number().int().positive().optional(),
  baseAudio: RoleplayAudioSchema,
}).refine(
  ({ interpreterId, recruitmentCandidateId }) => Boolean(interpreterId) !== Boolean(recruitmentCandidateId),
  'Selecciona exactamente un intérprete o un candidato.',
);

export const RoleplayEvaluationSchema = z.object({
  sessionId: z.string().min(1),
  protocolScore: z.coerce.number().min(0).max(100),
  interpretationScore: z.coerce.number().min(0).max(100),
  languageScore: z.coerce.number().min(0).max(100),
  serviceScore: z.coerce.number().min(0).max(100),
  technicalScore: z.coerce.number().min(0).max(100),
  criticalError: z.boolean(),
  comments: z.string().trim().max(5000).optional(),
});

export function calculateRoleplayScore(scores: Omit<z.infer<typeof RoleplayEvaluationSchema>, 'sessionId' | 'criticalError' | 'comments'> & { criticalError: boolean }) {
  if (scores.criticalError) return 0;
  return (scores.protocolScore * 0.2)
    + (scores.interpretationScore * 0.4)
    + (scores.languageScore * 0.2)
    + (scores.serviceScore * 0.1)
    + (scores.technicalScore * 0.1);
}
