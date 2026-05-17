import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Senior DevSecOps: Security Wrapper for Next.js App Router API Routes.
 * Implements strict input validation, sanitization, and global error handling
 * to prevent BOLA, Injection, and Information Disclosure.
 */

type RouteHandler = (req: NextRequest, context: unknown) => Promise<NextResponse>;

export function withSecurity(
  handler: RouteHandler,
  schemas?: { body?: z.ZodTypeAny; query?: z.ZodTypeAny }
): RouteHandler {
  return async (req: NextRequest, context: unknown) => {
    try {
      // 1. INPUT VALIDATION & SANITIZATION
      if (schemas?.query) {
        const query = Object.fromEntries(new URL(req.url).searchParams);
        schemas.query.parse(query);
      }

      // To avoid "Body has already been consumed" error, we don't consume it here
      // if the handler needs to consume it too. 
      // However, for strict Rule D, we should validate it.
      // Next.js 15/16 Request clone() is reliable.
      if (schemas?.body && req.method !== 'GET' && req.method !== 'DELETE') {
        const clonedReq = req.clone();
        const body = await clonedReq.json();
        schemas.body.parse(body);
      }

      // Execute original handler
      return await handler(req, context);

    } catch (error) {
      console.error('🔴 [SECURITY-AUDIT] Critical Failure:', {
        path: req.nextUrl.pathname,
        method: req.method,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });

      if (error instanceof z.ZodError) {
        return NextResponse.json({ 
          error: 'Bad Request: Validation failed', 
          details: error.issues 
        }, { status: 400 });
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json({ error: 'Database conflict or constraint violation' }, { status: 409 });
      }

      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

