'use server';

import prismaClient from '@/lib/prisma';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

const prisma = prismaClient;

// Zod Schema para validación estricta Server-Side
const QAEvaluationSchema = z.object({
  interpreterId: z.number().positive(),
  productionLogId: z.number().positive().optional().nullable(),
  protocolScore: z.number().min(0).max(100),
  interpretationScore: z.number().min(0).max(100),
  languageScore: z.number().min(0).max(100),
  serviceScore: z.number().min(0).max(100),
  technicalScore: z.number().min(0).max(100),
  criticalError: z.boolean(),
  comments: z.string().optional(),
});

export async function submitQAEvaluation(prevState: any, formData: FormData) {
  try {
    const session = await auth();
    // Protección de acceso estricta
    if (!session || session.user?.role !== 'admin') {
      return { success: false, error: 'Unauthorized access. Permisos de Administrador requeridos.' };
    }

    const auditorEmail = session.user?.email || 'System Admin';

    // Extracción de FormData compatible con React 19 useActionState
    const rawData = {
      interpreterId: parseInt(formData.get('interpreterId') as string) || 0,
      productionLogId: formData.get('productionLogId') ? parseInt(formData.get('productionLogId') as string) : null,
      protocolScore: parseFloat(formData.get('protocolScore') as string) || 0,
      interpretationScore: parseFloat(formData.get('interpretationScore') as string) || 0,
      languageScore: parseFloat(formData.get('languageScore') as string) || 0,
      serviceScore: parseFloat(formData.get('serviceScore') as string) || 0,
      technicalScore: parseFloat(formData.get('technicalScore') as string) || 0,
      criticalError: formData.get('criticalError') === 'on' || formData.get('criticalError') === 'true',
      comments: formData.get('comments') as string || '',
    };

    const parsed = QAEvaluationSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: 'Validación fallida: Todos los scores deben estar entre 0 y 100.' };
    }

    const data = parsed.data;

    // Regla de Negocio Crítica: Bloqueo de Score por Error Crítico
    let totalScore = 0;
    if (data.criticalError) {
      totalScore = 0; // Lock absoluto a 0.00
    } else {
      // Fórmula de Ponderación Estándar
      totalScore = 
        (data.protocolScore * 0.20) +
        (data.interpretationScore * 0.40) +
        (data.languageScore * 0.20) +
        (data.serviceScore * 0.10) +
        (data.technicalScore * 0.10);
    }

    let actionRequired = 'Ninguna';
    if (data.criticalError || totalScore < 70) actionRequired = 'Advertencia / Coaching';
    else if (totalScore < 85) actionRequired = 'Feedback Requerido';

    // Inserción Atómica
    await prisma.qAScore.create({
      data: {
        interpreterId: data.interpreterId,
        productionLogId: data.productionLogId || null,
        auditDate: new Date(),
        auditor: auditorEmail,
        protocolScore: data.protocolScore,
        interpretationScore: data.interpretationScore,
        languageScore: data.languageScore,
        serviceScore: data.serviceScore,
        technicalScore: data.technicalScore,
        totalScore, // Guardado directo validado en el servidor
        criticalError: data.criticalError,
        comentarios: data.comments,
        accionRequerida: actionRequired
      }
    });

    // Invalidate ISR caches
    revalidatePath('/qa');
    revalidatePath('/admin');
    
    return { success: true, message: `Evaluación guardada con éxito. (Score: ${totalScore.toFixed(2)}%)` };
  } catch (error: any) {
    console.error('❌ QA Server Action Error:', error);
    return { success: false, error: error.message || 'Error catastrófico en la base de datos' };
  }
}
