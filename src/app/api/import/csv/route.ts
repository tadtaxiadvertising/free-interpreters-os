import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { 
  InterpreterSchema, 
  ProductionLogSchema, 
  QAScoreSchema,
  parsePercentage,
  parseDecimal,
  parseTime
} from '@/lib/validators';
import csv from 'csv-parser';
import { Readable } from 'stream';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'interpreters' | 'production' | 'qa'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const stream = Readable.from(buffer);
    
    const results: any[] = [];
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    if (type === 'interpreters') {
      for (const row of results) {
        try {
          const validated = InterpreterSchema.parse({
            externalId: row.ID || row.externalId,
            name: row.Name || row.name,
            status: row.Status || row.status || 'Activo',
            campaign: row.Campaign || row.campaign,
            tariffPerMinute: parseFloat(row.Tariff || row.tariffPerMinute || '0.15'),
          });

          await prisma.interpreter.upsert({
            where: { externalId: validated.externalId },
            update: validated,
            create: validated,
          });
          successCount++;
        } catch (e: any) {
          errorCount++;
          errors.push(`Row ${results.indexOf(row) + 1}: ${e.message}`);
        }
      }
    } else if (type === 'production') {
      for (const row of results) {
        try {
          // Find interpreter by externalId or Name
          const interpreter = await prisma.interpreter.findFirst({
            where: { 
              OR: [
                { externalId: row.InterpreterID || row.ID },
                { name: row.Interpreter || row.Name }
              ]
            }
          });

          if (!interpreter) throw new Error(`Interpreter not found: ${row.Interpreter}`);

          const validated = ProductionLogSchema.parse({
            interpreterId: interpreter.id,
            date: new Date(row.Date),
            interpretedMinutes: parseInt(row.Minutes || row.interpretedMinutes || '0'),
            callsAttended: parseInt(row.Calls || '0'),
            adherence: parsePercentage(row.Adherence),
            campaign: row.Campaign,
          });

          await prisma.productionLog.create({ data: validated });
          successCount++;
        } catch (e: any) {
          errorCount++;
          errors.push(`Row ${results.indexOf(row) + 1}: ${e.message}`);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      successCount, 
      errorCount, 
      errors: errors.slice(0, 10) 
    });

  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
