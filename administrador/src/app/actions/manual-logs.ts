"use server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const db = prisma;

export async function createManualLog(data: {
  interpreterId: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  totalMinutes: number;
}): Promise<ActionResult<unknown>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  // Verify admin role via Prisma
  const profile = await db.userProfile.findUnique({
    where: { id: user.id },
    select: { role: true }
  });
  if (profile?.role !== 'admin') {
    return { success: false, error: 'Admin access required', code: 'UNAUTHORIZED' };
  }

  try {
    const { interpreterId, date, startTime, endTime, totalMinutes } = data;

    // Validate Interpreter
    const interpreter = await prisma.interpreter.findUnique({
      where: { id: interpreterId },
    });

    if (!interpreter) {
      return { success: false, error: "Intérprete no encontrado." };
    }

    // Parse Dates
    const logDate = new Date(`${date}T00:00:00Z`);
    const now = new Date();

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    if (startDateTime > now || endDateTime > now || logDate > now) {
      return { success: false, error: "No se puede registrar tiempos en el futuro." };
    }

    if (endDateTime <= startDateTime) {
      // Handle overnight shift if necessary, but assuming same day for simplicity
      return { success: false, error: "La hora de fin debe ser mayor a la hora de inicio." };
    }

    // Create Production Log
    const newLog = await prisma.productionLog.create({
      data: {
        interpreterId: interpreter.id,
        date: logDate,
        loginTime: startDateTime,
        logoutTime: endDateTime,
        interpretedMinutes: totalMinutes,
        verifiedMinutes: totalMinutes, // For Payroll Engine
        status: "Completed",
        observaciones: "Entry Type: MANUAL",
      },
    });

    return { success: true, data: newLog };
  } catch (error) {
    console.error("Error creating manual log:", error);
    const message = error instanceof Error ? error.message : "Error interno del servidor.";
    return { success: false, error: message };
  }
}

export async function getInterpretersForSelect(): Promise<ActionResult<{ id: number; name: string; externalId: string }[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const interpreters = await prisma.interpreter.findMany({
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
  } catch (error) {
    console.error("Error fetching interpreters:", error);
    return { success: false, error: "Error obteniendo intérpretes." };
  }
}
