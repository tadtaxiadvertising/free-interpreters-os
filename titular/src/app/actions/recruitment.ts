'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

const db = prisma;

/** Shared admin guard for recruitment actions */
async function requireAdmin(): Promise<{ userId: string } | ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  const profile = await db.userProfile.findUnique({
    where: { id: user.id },
    select: { role: true }
  });
  if (profile?.role !== 'admin') {
    return { success: false, error: 'Admin access required', code: 'UNAUTHORIZED' };
  }

  return { userId: user.id };
}

/**
 * ACTION: Delete Candidate
 */
export async function deleteCandidate(id: number): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ('success' in auth) return auth as ActionResult;

  try {
    await db.recruitmentCandidate.delete({
      where: { id }
    });

    revalidatePath('/admin/recruitment');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in deleteCandidate action:', message);
    return { 
      success: false, 
      error: message,
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * ACTION: Hire Candidate (Convert to Interpreter)
 * Placeholder for actual hiring logic
 */
export async function hireCandidate(id: number): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ('success' in auth) return auth as ActionResult;

  try {
    const candidate = await db.recruitmentCandidate.findUnique({
      where: { id }
    });

    if (!candidate) {
      return { success: false, error: 'Candidate not found', code: 'NOT_FOUND' };
    }

    // Actual implementation would create an interpreter record, user profile, etc.
    // For now, just update status
    await db.recruitmentCandidate.update({
      where: { id },
      data: { status: 'Contratado' }
    });

    revalidatePath('/admin/recruitment');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in hireCandidate action:', message);
    return { 
      success: false, 
      error: message,
      code: 'INTERNAL_ERROR'
    };
  }
}
