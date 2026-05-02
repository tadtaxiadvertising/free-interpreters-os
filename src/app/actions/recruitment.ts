'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/lib/types';

const db = prisma as any;

/**
 * ACTION: Delete Candidate
 */
export async function deleteCandidate(id: number): Promise<ActionResult> {
  try {
    await db.candidate.delete({
      where: { id }
    });

    revalidatePath('/admin/recruitment');
    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteCandidate action:', error.message);
    return { 
      success: false, 
      error: error.message || 'Failed to delete candidate',
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * ACTION: Hire Candidate (Convert to Interpreter)
 * Placeholder for actual hiring logic
 */
export async function hireCandidate(id: number): Promise<ActionResult> {
  try {
    const candidate = await db.candidate.findUnique({
      where: { id }
    });

    if (!candidate) {
      return { success: false, error: 'Candidate not found', code: 'NOT_FOUND' };
    }

    // Actual implementation would create an interpreter record, user profile, etc.
    // For now, just update status
    await db.candidate.update({
      where: { id },
      data: { status: 'Contratado' }
    });

    revalidatePath('/admin/recruitment');
    return { success: true };
  } catch (error: any) {
    console.error('Error in hireCandidate action:', error.message);
    return { 
      success: false, 
      error: error.message || 'Failed to hire candidate',
      code: 'INTERNAL_ERROR'
    };
  }
}
