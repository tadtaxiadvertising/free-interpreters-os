import { NextResponse } from 'next/server';
import { z } from 'zod';

export type ApiErrorInput = {
  error: unknown;
  fallback: string;
  status?: number;
  exposeMessage?: boolean;
};

export function apiSuccess<T>(data?: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, ...(data === undefined ? {} : { data }) }, init);
}

export function apiError({ error, fallback, status = 500, exposeMessage = false }: ApiErrorInput) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: error.issues },
      { status: 400 }
    );
  }

  const message = exposeMessage && status < 500 && error instanceof Error ? error.message : fallback;
  return NextResponse.json({ success: false, error: message || fallback }, { status });
}

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(request: Request, schema: TSchema): Promise<z.infer<TSchema>> {
  const body = await request.json().catch(() => ({}));
  return schema.parse(body);
}


export function isPrismaKnownErrorCode(error: unknown, code: string) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === code
  );
}

export const numericIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const stringIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Missing ID'),
});
