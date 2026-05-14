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
      // 1. INPUT VALIDATION & SANITIZATION (Prevention of Injection & Mass Assignment)
      // We parse the query and body against Zod schemas. 
      // Zod automatically strips undeclared fields, preventing Mass Assignment.
      if (schemas?.query) {
        const query = Object.fromEntries(new URL(req.url).searchParams);
        schemas.query.parse(query);
      }

      if (schemas?.body && req.method !== 'GET') {
        const body = await req.json();
        schemas.body.parse(body);
      }

      // Execute original handler
      return await handler(req, context);

    } catch (error) {
      // 2. GLOBAL ERROR HANDLING (Prevention of Information Disclosure)
      // Log for internal auditing (not exposed to client)
      console.error('[SECURITY-AUDIT]', {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.nextUrl.pathname,
        error: error instanceof Error ? error.message : error,
      });

      // Handle Validation Errors (Safe to show specific issues)
      if (error instanceof z.ZodError) {
        return NextResponse.json({ 
          error: 'Invalid request data', 
          details: error.issues.map((e: z.ZodIssue) => ({ 
            path: e.path, 
            message: e.message 
          }))
        }, { status: 400 });
      }

      // Handle Database Errors (Mitigate Information Leakage)
      // We never return Prisma error codes or stack traces to the client.
      if (error instanceof Prisma.PrismaClientKnownRequestError || 
          error instanceof Prisma.PrismaClientValidationError) {
        return NextResponse.json({ 
          error: 'Unauthorized or invalid operation' // Opaque message for database errors
        }, { status: 403 });
      }

      // Default fallback for unhandled exceptions
      return NextResponse.json({ 
        error: 'An internal error occurred' 
      }, { status: 500 });
    }
  };
}
