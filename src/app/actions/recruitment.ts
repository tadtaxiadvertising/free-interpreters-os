'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/lib/types';
import { validateAction } from '@/lib/auth/actions';

const db = prisma;

/**
 * ACTION: Delete Candidate
 */
export async function deleteCandidate(id: number): Promise<ActionResult> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    await db.recruitmentCandidate.delete({
      where: { id }
    });

    revalidatePath('/admin/recruitment');
    return { success: true };
  } catch (error) {
    console.error('Error in deleteCandidate action:', error);
    return { 
      success: false, 
      error: 'Failed to delete candidate',
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * ACTION: Hire Candidate (Convert to Interpreter)
 * Placeholder for actual hiring logic
 */
export async function hireCandidate(id: number): Promise<ActionResult> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

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
    console.error('Error in hireCandidate action:', error);
    return { 
      success: false, 
      error: 'Failed to hire candidate',
      code: 'INTERNAL_ERROR'
    };
  }
}
