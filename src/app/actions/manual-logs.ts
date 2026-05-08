"use server";

import prisma from "@/lib/prisma";

export async function createManualLog(data: {
  interpreterId: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}) {
  try {
    const { interpreterId, date, startTime, endTime } = data;

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

    // Calculate Minutes
    const diffMs = endDateTime.getTime() - startDateTime.getTime();
    const interpretedMinutes = Math.floor(diffMs / 60000);

    // Create Production Log
    const newLog = await prisma.productionLog.create({
      data: {
        interpreterId: interpreter.id,
        date: logDate,
        loginTime: startDateTime,
        logoutTime: endDateTime,
        interpretedMinutes,
        verifiedMinutes: interpretedMinutes, // For Payroll Engine
        status: "Manual",
        observaciones: "Entry Type: MANUAL",
      },
    });

    return { success: true, data: newLog };
  } catch (error: any) {
    console.error("Error creating manual log:", error);
    return { success: false, error: error.message || "Error interno del servidor." };
  }
}

export async function getInterpretersForSelect() {
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
  } catch (error: any) {
    console.error("Error fetching interpreters:", error);
    return { success: false, error: "Error obteniendo intérpretes." };
  }
}
