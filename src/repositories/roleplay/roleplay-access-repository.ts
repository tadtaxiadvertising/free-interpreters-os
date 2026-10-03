import prisma from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';

const db = prisma;

export interface CreateAccessInput {
  sessionId: string;
  expiresAt: Date;
  tokenHash?: string; // If not provided, generate one
}

export interface AccessWithToken {
  id: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  validatedAt: Date | null;
  startedAt: Date | null;
  createdAt: Date;
  rawToken?: string; // Only returned on creation
}

export class RoleplayAccessRepository {
  /**
   * Get or create access for a session (idempotent)
   * Returns existing access if exists, otherwise creates new
   */
  async getOrCreateAccess(sessionId: string, expiresInDays = 7): Promise<AccessWithToken> {
    const existing = await db.roleplayAccess.findUnique({
      where: { sessionId },
    });

    if (existing) {
      return { ...existing, rawToken: undefined };
    }

    // Generate new token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const created = await db.roleplayAccess.create({
      data: {
        sessionId,
        tokenHash,
        expiresAt,
      },
    });

    return { ...created, rawToken };
  }

  /**
   * Find access by token hash (for validation)
   */
  async findByTokenHash(tokenHash: string) {
    return db.roleplayAccess.findUnique({
      where: { tokenHash },
      include: { session: true },
    });
  }

  /**
   * Validate token without consuming it
   * Returns access info if valid, null if invalid/expired/used
   */
  async validateToken(token: string): Promise<AccessWithToken | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const access = await this.findByTokenHash(tokenHash);

    if (!access) return null;
    if (access.usedAt) return null; // Already consumed
    if (access.expiresAt < new Date()) return null; // Expired
    if (!['DRAFT', 'INVITED', 'PENDING'].includes(access.session.status)) return null;

    return access;
  }

  /**
   * Mark token as validated (user clicked link, verified)
   * Does NOT consume - just records validation time
   */
  async markValidated(token: string): Promise<AccessWithToken | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    
    const updated = await db.roleplayAccess.update({
      where: { 
        tokenHash,
        validatedAt: null, // Only if not already validated
      },
      data: { validatedAt: new Date() },
      include: { session: true },
    });

    return updated;
  }

  /**
   * Mark token as started (user actually began the roleplay)
   * Does NOT consume - just records start time
   */
  async markStarted(token: string): Promise<AccessWithToken | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    
    const updated = await db.roleplayAccess.update({
      where: { 
        tokenHash,
        startedAt: null, // Only if not already started
      },
      data: { startedAt: new Date() },
      include: { session: true },
    });

    return updated;
  }

  /**
   * Consume token (final step - user submitted first response)
   * After this, token cannot be used again
   */
  async consumeToken(token: string): Promise<AccessWithToken | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    
    const updated = await db.roleplayAccess.update({
      where: { 
        tokenHash,
        usedAt: null, // Only if not already consumed
      },
      data: { usedAt: new Date() },
      include: { session: true },
    });

    return updated;
  }

  /**
   * Get access by session ID
   */
  async findBySessionId(sessionId: string) {
    return db.roleplayAccess.findUnique({
      where: { sessionId },
      include: { session: true },
    });
  }

  /**
   * Extend expiration (for admin use)
   */
  async extendExpiration(sessionId: string, additionalDays: number) {
    const access = await this.findBySessionId(sessionId);
    if (!access) return null;

    const newExpiresAt = new Date(access.expiresAt.getTime() + additionalDays * 24 * 60 * 60 * 1000);
    
    return db.roleplayAccess.update({
      where: { sessionId },
      data: { expiresAt: newExpiresAt },
    });
  }

  /**
   * Clean up expired unused tokens
   */
  async cleanupExpired() {
    return db.roleplayAccess.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        usedAt: null,
      },
    });
  }
}

export const roleplayAccessRepository = new RoleplayAccessRepository();