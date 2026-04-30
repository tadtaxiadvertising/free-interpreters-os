import { createClient } from './supabase/server';

interface PayrollInput {
  interpreterId: number;
  periodStart: Date;
  periodEnd: Date;
}

interface PayrollCalculation {
  totalMinutes: number;
  grossTotal: number;
  qualityBonus: number;
  penalidades: number;
  netTotal: number;
}

/**
 * Calcula nómina para un intérprete en un período específico
 * Optimizado usando Supabase Client y RLS
 */
export async function calculatePayroll(
  input: PayrollInput
): Promise<PayrollCalculation> {
  const { interpreterId, periodStart, periodEnd } = input;
  const supabase = await createClient();

  // 1. Obtener datos del intérprete y sus tasas por cuenta
  const { data: interpreter, error: interpError } = await supabase
    .from('interpreters')
    .select('*, interpreter_account_rates(*)')
    .eq('id', interpreterId)
    .single();

  if (interpError || !interpreter) {
    throw new Error(`Interpreter ${interpreterId} not found`);
  }

  // 2. Obtener logs de producción
  const { data: productionLogs } = await supabase
    .from('production_logs')
    .select('id, interpreted_minutes, account_id')
    .eq('interpreter_id', interpreterId)
    .gte('date', periodStart.toISOString())
    .lte('date', periodEnd.toISOString());

  // 3. Obtener logs de llamadas en tiempo real (usando la tabla nativa)
  const { data: callSessions } = await supabase
    .from('call_sessions')
    .select('duration_seconds, call_cost')
    .eq('interpreter_id', interpreterId)
    .gte('started_at', periodStart.toISOString())
    .lte('started_at', periodEnd.toISOString())
    .not('ended_at', 'is', null);

  // 4. Obtener scores de QA
  const { data: qaScores } = await supabase
    .from('qa_scores')
    .select('total_score, critical_error')
    .eq('interpreter_id', interpreterId)
    .gte('audit_date', periodStart.toISOString())
    .lte('audit_date', periodEnd.toISOString());

  // Cálculos de minutos
  const importedMinutes = (productionLogs || []).reduce((sum, log) => sum + log.interpreted_minutes, 0);
  const realtimeMinutes = Math.round((callSessions || []).reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / 60);
  const totalMinutes = importedMinutes + realtimeMinutes;

  // Cálculos de costos
  let importedCost = 0;
  const baseRatePerMinute = parseFloat(interpreter.tariff_per_minute.toString());

  for (const log of (productionLogs || [])) {
    let ratePerMinute = baseRatePerMinute;
    if (log.account_id) {
      const specificRate = interpreter.interpreter_account_rates.find((r: any) => r.account_id === log.account_id);
      if (specificRate) {
        ratePerMinute = parseFloat(specificRate.tariff_per_hour.toString()) / 60;
      }
    }
    importedCost += log.interpreted_minutes * ratePerMinute;
  }

  const realtimeCost = (callSessions || []).reduce((sum, call) => sum + parseFloat(call.call_cost || '0'), 0);
  const grossTotal = importedCost + realtimeCost;

  // Bonus de calidad: +5% si promedio QA >= 90%
  let qualityBonus = 0;
  if (qaScores && qaScores.length > 0) {
    const avgQA = qaScores.reduce((sum, qa) => sum + (parseFloat(qa.total_score) || 0), 0) / qaScores.length;
    if (avgQA >= 90) {
      qualityBonus = grossTotal * 0.05;
    }
  }

  // Penalidades: -10% por error crítico
  let penalidades = 0;
  const criticalErrors = (qaScores || []).filter(qa => qa.critical_error).length;
  if (criticalErrors > 0) {
    penalidades = grossTotal * 0.1 * criticalErrors;
  }

  const subtotal = grossTotal + qualityBonus - penalidades;
  const transferDeduction = subtotal * 0.015; // 1.5%
  const netTotal = subtotal - transferDeduction;

  return {
    totalMinutes,
    grossTotal: Math.round(grossTotal * 100) / 100,
    qualityBonus: Math.round(qualityBonus * 100) / 100,
    penalidades: Math.round(penalidades * 100) / 100,
    netTotal: Math.round(netTotal * 100) / 100,
  };
}

export async function createPayrollRecord(
  interpreterId: number,
  periodStart: Date,
  periodEnd: Date
) {
  const calculation = await calculatePayroll({ interpreterId, periodStart, periodEnd });
  const supabase = await createClient();

  const { data: record, error } = await supabase
    .from('payroll_records')
    .insert({
      interpreter_id: interpreterId,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      total_minutes: calculation.totalMinutes,
      gross_total: calculation.grossTotal,
      quality_bonus: calculation.qualityBonus,
      penalidades: calculation.penalidades,
      transfer_deduction: Math.round(calculation.netTotal * 0.015 * 100) / 100,
      net_total: calculation.netTotal,
      status: 'Pendiente'
    })
    .select()
    .single();

  if (error) throw error;
  return record;
}

export async function calculateBatchPayroll(
  interpreterIds: number[],
  periodStart: Date,
  periodEnd: Date
) {
  const results = await Promise.all(
    interpreterIds.map((id) => calculatePayroll({ interpreterId: id, periodStart, periodEnd }))
  );
  return results;
}
