import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  console.log('--- Iniciando sincronización de CallSessions a ProductionLogs ---');

  try {
    const sessions = await prisma.callSession.findMany({
      where: {
        endedAt: { not: null },
        notes: {
          notIn: ['Manual entry via Admin Server Action', 'Manual entry by Administrator']
        }
      }
    });

    console.log(`Se encontraron ${sessions.length} sesiones en vivo completadas.`);

    const grouped = new Map<string, number>(); 
    const callCount = new Map<string, number>(); 

    const getLocalDateStr = (d: Date) => {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santo_Domingo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    };

    for (const session of sessions) {
      if (!session.startedAt || !session.durationSeconds) continue;
      
      const dayStr = getLocalDateStr(session.startedAt);
      const key = `${session.interpreterId}_${dayStr}`;
      const minutes = Math.floor(session.durationSeconds / 60);
      
      if (minutes > 0) {
        const existing = grouped.get(key) || 0;
        grouped.set(key, existing + minutes);
        
        const existingCalls = callCount.get(key) || 0;
        callCount.set(key, existingCalls + 1);
      }
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const [key, extraMinutes] of grouped.entries()) {
      const [interpreterIdStr, dayStr] = key.split('_');
      const interpreterId = parseInt(interpreterIdStr, 10);
      const calls = callCount.get(key) || 0;

      const logDate = new Date(`${dayStr}T12:00:00Z`);

      const allLogsForInt = await prisma.productionLog.findMany({
        where: { interpreterId }
      });

      const existingLog = allLogsForInt.find(l => getLocalDateStr(l.date) === dayStr);

      if (existingLog) {
        if (existingLog.observaciones?.includes('Sincronizado desde llamadas en vivo')) {
          continue; 
        }

        await prisma.productionLog.update({
          where: { id: existingLog.id },
          data: {
            interpretedMinutes: (existingLog.interpretedMinutes || 0) + extraMinutes,
            callsAttended: (existingLog.callsAttended || 0) + calls,
            observaciones: existingLog.observaciones 
              ? `${existingLog.observaciones} | Sincronizado desde llamadas en vivo (+${extraMinutes}m)`
              : `Sincronizado desde llamadas en vivo (+${extraMinutes}m)`
          }
        });
        updatedCount++;
      } else {
        await prisma.productionLog.create({
          data: {
            interpreterId,
            date: logDate,
            interpretedMinutes: extraMinutes,
            callsAttended: calls,
            status: 'Completed',
            observaciones: 'Sincronizado desde llamadas en vivo',
            adherence: 100
          }
        });
        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sincronización completada',
      createdCount,
      updatedCount
    });
  } catch (error: any) {
    console.error('Error syncing:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
