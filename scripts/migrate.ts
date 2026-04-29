import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import prisma from '../src/lib/prisma';
import {
  InterpreterSchema,
  ProductionLogSchema,
  QAScoreSchema,
  PayrollRecordSchema,
  RecruitmentCandidateSchema,
  parsePercentage,
  parseDecimal,
} from '../src/lib/validators';
import { Prisma } from '@prisma/client';

const CSV_DIR = path.join(__dirname, '../Documentation/05_Tools_Excel_Sheets');

interface CSVRow {
  [key: string]: string;
}

// Utilidad para leer CSV de manera más eficiente
function readCSV(filename: string): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const results: CSVRow[] = [];
    fs.createReadStream(path.join(CSV_DIR, filename))
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function migrateInterpreters() {
  console.log('🔄 Migrating Interpreters from Master Roster...');
  const rows = await readCSV('01_Master_Roster.csv');

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const validated = InterpreterSchema.parse({
        externalId: row.ID,
        name: row['Nombre Completo'],
        status: row.Estado,
        languageA: row['Idioma A'] || 'Español',
        languageB: row['Idioma B'] || 'Inglés',
        emailCorporativo: row['Email Corporativo'],
        telefono: row.Teléfono,
        pais: row.País,
        metodoPago: row['Método Pago'],
        cuentaPago: row['Cuenta Pago'],
        documentosCompleto: row['Documentos Completos'] === 'SI',
        notas: row.Notas,
        tariffPerMinute: 0.12, // Default
      });

      const existing = await prisma.interpreter.findUnique({
        where: { externalId: validated.externalId },
      });

      if (existing) {
        await prisma.interpreter.update({
          where: { id: existing.id },
          data: validated,
        });
        updated++;
      } else {
        await prisma.interpreter.create({
          data: validated,
        });
        created++;
      }

      console.log(`✅ ${validated.name} (${validated.externalId})`);
    } catch (error) {
      console.error(`❌ Row error: ${row.ID}`, error instanceof Error ? error.message : error);
      errors++;
    }
  }

  console.log(`📊 Interpreters: ${created} created, ${updated} updated, ${errors} errors\n`);
  return { created, updated, errors };
}

async function migrateProductionLogs() {
  console.log('🔄 Migrating Production Logs...');
  const rows = await readCSV('02_Production_Log.csv');

  let inserted = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const interpreter = await prisma.interpreter.findUnique({
        where: { externalId: row['ID Intérprete'] },
      });

      if (!interpreter) {
        console.warn(`⚠️  Interpreter ${row['ID Intérprete']} not found`);
        continue;
      }

      const validated = ProductionLogSchema.parse({
        interpreterId: interpreter.id,
        date: row.Fecha,
        campaign: row.Campaña,
        scheduledHours: row['Horario Programado'],
        interpretedMinutes: parseInt(row['Minutos Interpretados']) || 0,
        callsAttended: parseInt(row['Llamadas Atendidas']) || 0,
        adherence: parsePercentage(row['Adherencia %']),
        status: row.Estado,
        observaciones: row.Observaciones,
      });

      await prisma.productionLog.create({
        data: validated,
      });

      inserted++;
    } catch (error) {
      console.error(`❌ Row error:`, error instanceof Error ? error.message : error);
      errors++;
    }
  }

  console.log(`📊 Production Logs: ${inserted} inserted, ${errors} errors\n`);
  return { inserted, errors };
}

async function migrateQAScores() {
  console.log('🔄 Migrating QA Scores...');
  const rows = await readCSV('03_QA_Scorecard.csv');

  let inserted = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const interpreter = await prisma.interpreter.findUnique({
        where: { externalId: row['ID Intérprete'] },
      });

      if (!interpreter) {
        console.warn(`⚠️  Interpreter ${row['ID Intérprete']} not found`);
        continue;
      }

      // Buscar production log más cercano a esta fecha
      const productionLog = await prisma.productionLog.findFirst({
        where: {
          interpreterId: interpreter.id,
          date: new Date(row.Fecha),
        },
      });

      if (!productionLog) {
        console.warn(`⚠️  No production log for ${row['ID Intérprete']} on ${row.Fecha}`);
        continue;
      }

      const validated = QAScoreSchema.parse({
        productionLogId: productionLog.id,
        interpreterId: interpreter.id,
        auditDate: row.Fecha,
        auditor: row.Auditor,
        callDuration: parseInt(row['Duración Llamada (min)']) || undefined,
        callType: row['Tipo Llamada'],
        protocolScore: parsePercentage(row['1. Protocolo (20%)']),
        interpretationScore: parsePercentage(row['2. Interpretación (40%)']),
        languageScore: parsePercentage(row['3. Lenguaje (20%)']),
        serviceScore: parsePercentage(row['4. Servicio (10%)']),
        technicalScore: parsePercentage(row['5. Técnico (10%)']),
        totalScore: parsePercentage(row['TOTAL SCORE %']),
        criticalError: row['Error Crítico?'] === 'SI',
        comentarios: row.Comentarios,
        accionRequerida: row['Acción Requerida'] as any,
      });

      await prisma.qAScore.create({
        data: validated,
      });

      inserted++;
    } catch (error) {
      console.error(`❌ Row error:`, error instanceof Error ? error.message : error);
      errors++;
    }
  }

  console.log(`📊 QA Scores: ${inserted} inserted, ${errors} errors\n`);
  return { inserted, errors };
}

async function migratePayroll() {
  console.log('🔄 Migrating Payroll Records...');
  const rows = await readCSV('04_Payroll_Calculator.csv');

  let inserted = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const interpreter = await prisma.interpreter.findUnique({
        where: { externalId: row['ID Intérprete'] },
      });

      if (!interpreter) {
        console.warn(`⚠️  Interpreter ${row['ID Intérprete']} not found`);
        continue;
      }

      const validated = PayrollRecordSchema.parse({
        periodStart: row['Periodo Inicio'],
        periodEnd: row['Periodo Fin'],
        interpreterId: interpreter.id,
        totalMinutes: parseInt(row['Minutos Totales']) || 0,
        grossTotal: parseDecimal(row['Total Bruto ($)']) || 0,
        qualityBonus: parseDecimal(row['Bono Calidad ($)']) || 0,
        penalidades: parseDecimal(row['Penalidades ($)']) || 0,
        transferDeduction: parseDecimal(row['Deducción Transferencia ($)']) || 0,
        netTotal: parseDecimal(row['Total Neto a Pagar ($)']) || 0,
        status: row['Estado Pago'],
        paymentDate: row['Fecha Pago'] ? new Date(row['Fecha Pago']) : null,
      });

      await prisma.payrollRecord.create({
        data: {
          ...validated,
          grossTotal: new Prisma.Decimal(validated.grossTotal),
          qualityBonus: new Prisma.Decimal(validated.qualityBonus),
          penalidades: new Prisma.Decimal(validated.penalidades),
          transferDeduction: new Prisma.Decimal(validated.transferDeduction),
          netTotal: new Prisma.Decimal(validated.netTotal),
        },
      });

      inserted++;
    } catch (error) {
      console.error(`❌ Row error:`, error instanceof Error ? error.message : error);
      errors++;
    }
  }

  console.log(`📊 Payroll Records: ${inserted} inserted, ${errors} errors\n`);
  return { inserted, errors };
}

async function migrateRecruitment() {
  console.log('🔄 Migrating Recruitment Candidates...');
  const rows = await readCSV('05_Recruitment_Pipeline.csv');

  let inserted = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const validated = RecruitmentCandidateSchema.parse({
        name: row['Nombre Candidato'],
        email: row.Email,
        telefono: row.Teléfono,
        pais: row.País,
        fuente: row['Fuente (LinkedIn/FB)'],
        englishLevel: row['Nivel Inglés (C1/C2)'],
        speedtestMbps: parseInt(row['Speedtest (Mbps)']) || undefined,
        status: row.Estado,
        fechaPostulacion: row['Fecha Postulación'],
        fechaEntrevista: row['Fecha Entrevista'] ? new Date(row['Fecha Entrevista']) : null,
        resultRoleplay: parseInt(row['Resultado Roleplay']) || undefined,
        fechaOferta: row['Fecha Oferta'] ? new Date(row['Fecha Oferta']) : null,
        fechaInicio: row['Fecha Inicio'] ? new Date(row['Fecha Inicio']) : null,
        responsable: row.Responsable,
      });

      await prisma.recruitmentCandidate.create({
        data: validated,
      });

      inserted++;
    } catch (error) {
      console.error(`❌ Row error:`, error instanceof Error ? error.message : error);
      errors++;
    }
  }

  console.log(`📊 Recruitment Candidates: ${inserted} inserted, ${errors} errors\n`);
  return { inserted, errors };
}

async function main() {
  try {
    console.log('🚀 Starting Data Migration to Prisma/Supabase...\n');

    const interpretResult = await migrateInterpreters();
    const logResult = await migrateProductionLogs();
    const qaResult = await migrateQAScores();
    const payrollResult = await migratePayroll();
    const recruitmentResult = await migrateRecruitment();

    console.log('📈 MIGRATION SUMMARY:');
    console.log('=====================================');
    console.log(`Interpreters:    ${interpretResult.created}↑ ${interpretResult.updated}↔ ${interpretResult.errors}❌`);
    console.log(`Production Logs: ${logResult.inserted}↑ ${logResult.errors}❌`);
    console.log(`QA Scores:       ${qaResult.inserted}↑ ${qaResult.errors}❌`);
    console.log(`Payroll Records: ${payrollResult.inserted}↑ ${payrollResult.errors}❌`);
    console.log(`Recruitment:     ${recruitmentResult.inserted}↑ ${recruitmentResult.errors}❌`);
    console.log('=====================================');
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal migration error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
