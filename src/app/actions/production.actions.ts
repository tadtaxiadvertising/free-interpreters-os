'use server';

import prismaClient from '@/lib/prisma';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const prisma = prismaClient;

// Zod validation for chunks
const LogChunkSchema = z.object({
  headers: z.string(),
  rows: z.array(z.string())
});

export async function uploadLogChunk(prevState: any, data: { headers: string, rows: string[] }) {
  try {
    const parsed = LogChunkSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: 'Formato de datos inválido en el chunk.' };
    }

    const { headers, rows } = parsed.data;
    const headerCols = headers.split(',').map(h => h.trim().toLowerCase());

    const idxDate = headerCols.findIndex(h => h.includes('date') || h.includes('fecha'));
    const idxExternalId = headerCols.findIndex(h => h.includes('id') || h.includes('external'));
    const idxMinutes = headerCols.findIndex(h => h.includes('minute') || h.includes('minuto'));
    const idxAdherence = headerCols.findIndex(h => h.includes('adherence') || h.includes('adherencia'));

    if (idxDate === -1 || idxExternalId === -1) {
      return { success: false, error: 'CSV requiere columnas: Fecha, External ID.' };
    }

    let successCount = 0;

    for (const row of rows) {
      const cols = row.split(',').map(c => c.trim());
      if (cols.length < 2) continue;

      const dateStr = cols[idxDate];
      const externalId = cols[idxExternalId];
      const minutes = idxMinutes !== -1 ? parseInt(cols[idxMinutes]) || 0 : 0;
      const adherence = idxAdherence !== -1 ? parseFloat(cols[idxAdherence]) || 0 : 0;

      if (!dateStr || !externalId) continue;

      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) continue;

      const interpreter = await prisma.interpreter.findUnique({
        where: { externalId }
      });

      if (!interpreter) continue;

      await prisma.productionLog.create({
        data: {
          interpreterId: interpreter.id,
          date: dateObj,
          interpretedMinutes: minutes,
          adherence: adherence,
          status: 'Importado',
        }
      });
      successCount++;
    }

    revalidatePath('/admin');
    return { success: true, count: successCount, error: null };
  } catch (error: any) {
    console.error('❌ ERROR uploadLogChunk:', error);
    return { success: false, error: error.message || 'Error al procesar chunk' };
  }
}
