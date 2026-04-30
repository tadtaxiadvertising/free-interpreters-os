'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { InterpreterSchema, InterpreterInput } from '@/lib/validators';
import { ActionResult } from '@/lib/types';

/**
 * ACTION: Create Interpreter
 */
export async function createInterpreter(data: InterpreterInput): Promise<ActionResult<any>> {
  try {
    const validated = InterpreterSchema.parse(data);

    const interpreter = await prisma.interpreter.create({
      data: validated,
    });

    revalidatePath('/interpreters');
    revalidatePath('/admin');
    return { success: true, data: interpreter };
  } catch (error: any) {
    console.error('Error in createInterpreter action:', error);
    if (error.code === 'P2002') {
      return { 
        success: false, 
        error: `An interpreter with this ${error.meta?.target?.[0]} already exists.`,
        code: 'CONFLICT'
      };
    }
    return { 
      success: false, 
      error: error.message || 'Failed to create interpreter',
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * ACTION: Update Interpreter
 */
export async function updateInterpreter(id: number, data: Partial<InterpreterInput>): Promise<ActionResult<any>> {
  try {
    const validated = InterpreterSchema.partial().parse(data);

    const interpreter = await prisma.interpreter.update({
      where: { id },
      data: validated,
    });

    revalidatePath('/interpreters');
    revalidatePath(`/interpreters/${id}`);
    return { success: true, data: interpreter };
  } catch (error: any) {
    console.error('Error in updateInterpreter action:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to update interpreter',
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * ACTION: Delete Interpreter
 */
export async function deleteInterpreter(id: number): Promise<ActionResult> {
  try {
    await prisma.interpreter.delete({
      where: { id },
    });

    revalidatePath('/interpreters');
    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteInterpreter action:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to delete interpreter',
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * ACTION: Toggle Realtime Status
 */
export async function updateRealtimeStatus(id: number, status: 'Online' | 'Offline' | 'Busy'): Promise<ActionResult> {
  try {
    await prisma.interpreter.update({
      where: { id },
      data: { realtimeStatus: status },
    });

    revalidatePath('/interpreters');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating realtime status:', error);
    return { success: false, error: 'Failed to update status' };
  }
}
