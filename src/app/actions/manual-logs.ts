"use server";

import prisma from "@/lib/prisma";
import { validateAction } from "@/lib/auth/actions";
import type { ActionResult } from "@/lib/types";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const db = prisma;

const ManualLogSchema = z.object({
  interpreterId: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora de inicio inválido"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora de fin inválido"),
  totalMinutes: z.number().min(0),
});

/**
 * ACTION: Create Manual Production Log
 */
export async function createManualLog(data: any): Promise<ActionResult<{ id: number }>> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const validated = ManualLogSchema.parse(data);
    const { interpreterId, date, startTime, endTime, totalMinutes } = validated;

    // 1. Get Interpreter details for the API call
    const interpreter = await db.interpreter.findUnique({
      where: { id: interpreterId },
      select: { id: true, externalId: true }
    });

    if (!interpreter) {
      return { success: false, error: "Intérprete no encontrado.", code: 'NOT_FOUND' };
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    const now = new Date();

    if (startDateTime > now || endDateTime > now) {
      return { success: false, error: "No se puede registrar tiempos en el futuro.", code: 'VALIDATION_ERROR' };
    }

    // 2. Call the External API (Securely from Server)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const apiKey = process.env.API_SECRET_KEY; // Secure server-side key

    const apiResponse = await fetch(`${apiUrl}/api/v1/calls/manual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        interpreterId: interpreter.externalId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        notes: "Manual entry via Server Action"
      })
    });

    if (!apiResponse.ok) {
      const apiError = await apiResponse.json().catch(() => ({}));
      console.error("🔴 API ERROR:", apiError);
      return { success: false, error: "La API externa rechazó el registro.", code: 'INTERNAL_ERROR' };
    }

    // 3. Create local ProductionLog for the Dashboard
    const newLog = await db.productionLog.create({
      data: {
        interpreterId: interpreter.id,
        date: new Date(date),
        loginTime: startDateTime,
        logoutTime: endDateTime,
        interpretedMinutes: totalMinutes,
        verifiedMinutes: totalMinutes,
        status: "Completed",
        observaciones: "Manual Sync with API",
      },
      select: { id: true }
    });

    revalidatePath("/admin/production");
    return { success: true, data: { id: newLog.id } };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Datos de entrada inválidos", code: 'VALIDATION_ERROR' };
    }
    console.error("🔴 ERROR [createManualLog]:", error);
    return { success: false, error: "Error interno al crear el log manual.", code: 'INTERNAL_ERROR' };
  }
}

/**
 * ACTION: Get Interpreters for Select
 */
export async function getInterpretersForSelect(): Promise<ActionResult<{ id: number; name: string; externalId: string }[]>> {
  const auth = await validateAction();
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const interpreters = await db.interpreter.findMany({
      select: {
        id: true,
        name: true,
        externalId: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    
    return { success: true, data: interpreters };
  } catch (error: unknown) {
    console.error("🔴 ERROR [getInterpretersForSelect]:", error);
    return { success: false, error: "Error obteniendo la lista de intérpretes.", code: 'INTERNAL_ERROR' };
  }
}

