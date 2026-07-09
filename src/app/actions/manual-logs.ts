"use server";

import prisma from "@/lib/prisma";
import { validateAction } from "@/lib/auth/actions";
import type { ActionResult } from "@/lib/types";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { revalidateInterpreterProfileRecords } from "@/lib/cache/revalidate-interpreter";

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
 *
 * Nota de arquitectura:
 * - En Docker/Easypanel evitamos llamadas HTTP al propio dominio público para prevenir fallos DNS intermitentes.
 * - Persistimos directamente con Prisma y devolvemos errores controlados (degradación elegante).
 */
export async function createManualLog(data: unknown): Promise<ActionResult<{ id: number }>> {
  const auth = await validateAction("admin");
  if ("error" in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const validated = ManualLogSchema.parse(data);
    const { interpreterId, date, startTime, endTime, totalMinutes } = validated;

    const interpreter = await db.interpreter.findUnique({
      where: { id: interpreterId },
      select: { id: true, tariffPerMinute: true },
    });

    if (!interpreter) {
      return { success: false, error: "Intérprete no encontrado.", code: "NOT_FOUND" };
    }

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    const now = new Date();

    if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
      return { success: false, error: "Fecha u hora inválida.", code: "VALIDATION_ERROR" };
    }

    if (endDateTime <= startDateTime) {
      return {
        success: false,
        error: "La hora de fin debe ser mayor que la hora de inicio.",
        code: "VALIDATION_ERROR",
      };
    }

    if (startDateTime > now || endDateTime > now) {
      return {
        success: false,
        error: "No se puede registrar tiempos en el futuro.",
        code: "VALIDATION_ERROR",
      };
    }

    const durationSeconds = Math.max(0, Math.round(totalMinutes * 60));
    const tariffSnapshot = Number(interpreter.tariffPerMinute ?? 0);
    const callCost = (durationSeconds / 60) * tariffSnapshot;

    const result = await db.$transaction(async (tx) => {
      await tx.callSession.create({
        data: {
          interpreterId: interpreter.id,
          startedAt: startDateTime,
          endedAt: endDateTime,
          durationSeconds,
          tariffSnapshot,
          callCost,
          notes: "Manual entry via Admin Server Action",
        },
      });

      const newLog = await tx.productionLog.create({
        data: {
          interpreterId: interpreter.id,
          date: new Date(`${date}T12:00:00Z`),
          loginTime: startDateTime,
          logoutTime: endDateTime,
          interpretedMinutes: totalMinutes,
          verifiedMinutes: totalMinutes,
          status: "Completed",
          observaciones: "Manual Sync (sin llamada de red interna)",
        },
        select: { id: true },
      });

      return newLog;
    });

    revalidatePath("/admin/production");
    revalidateInterpreterProfileRecords(interpreter.id);
    return { success: true, data: { id: result.id } };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Datos de entrada inválidos", code: "VALIDATION_ERROR" };
    }
    console.error("🔴 ERROR [createManualLog]:", error);
    return { success: false, error: "Error interno al crear el log manual.", code: "INTERNAL_ERROR" };
  }
}

/**
 * ACTION: Get Interpreters for Select
 */
export async function getInterpretersForSelect(): Promise<ActionResult<{ id: number; name: string; externalId: string }[]>> {
  const auth = await validateAction();
  if ("error" in auth) return { success: false, error: auth.error, code: auth.code };

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
    return { success: false, error: "Error obteniendo la lista de intérpretes.", code: "INTERNAL_ERROR" };
  }
}
