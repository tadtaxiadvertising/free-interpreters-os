import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const CSV_DIR = path.join(__dirname, '../../../Documentation/05_Tools_Excel_Sheets');

async function migrateInterpreters() {
  console.log('Migrating Interpreters from Master Roster...');
  const results: any[] = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(CSV_DIR, '01_Master_Roster.csv'))
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        for (const row of results) {
          console.log(`Processing Interpreter: ${row['Nombre Completo']} (${row.ID})`);
          
          const { data, error } = await supabase
            .from('interpreters')
            .upsert({
              external_id: row.ID,
              name: row['Nombre Completo'],
              campaign: row.Estado,
              tariff_per_minute: 0.12 // Default tariff
            }, { onConflict: 'external_id' })
            .select();

          if (error) {
            console.error(`Error upserting interpreter ${row.ID}:`, error.message);
          }
        }
        console.log(`Migrated ${results.length} interpreters.`);
        resolve(true);
      })
      .on('error', reject);
  });
}

async function migrateProductionLogs() {
  console.log('Migrating Production Logs...');
  const results: any[] = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(CSV_DIR, '02_Production_Log.csv'))
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        for (const row of results) {
          // Find internal ID for the interpreter
          const { data: interpreter, error: findError } = await supabase
            .from('interpreters')
            .select('id')
            .eq('external_id', row['ID Intérprete'])
            .single();

          if (findError || !interpreter) {
            console.warn(`Interpreter ${row['ID Intérprete']} not found. Skipping log.`);
            continue;
          }

          const cleanAdherence = row['Adherencia %'] ? parseFloat(row['Adherencia %'].replace('%', '')) : null;
          const cleanQA = row['QA Score'] ? parseFloat(row['QA Score'].replace('%', '')) : null;

          const { error: insertError } = await supabase
            .from('production_logs')
            .insert({
              interpreter_id: interpreter.id,
              date: row.Fecha,
              scheduled_hours: row['Horario Programado'],
              interpreted_minutes: parseInt(row['Minutos Interpretados']) || 0,
              calls_attended: parseInt(row['Llamadas Atendidas']) || 0,
              adherence: cleanAdherence,
              qa_score: cleanQA,
              status: row.Estado,
              notes: row.Observaciones
            });

          if (insertError) {
            console.error(`Error inserting log for ${row['ID Intérprete']} on ${row.Fecha}:`, insertError.message);
          } else {
            console.log(`Migrated log for ${row['ID Intérprete']} on ${row.Fecha}`);
          }
        }
        resolve(true);
      })
      .on('error', reject);
  });
}

async function main() {
  try {
    await migrateInterpreters();
    await migrateProductionLogs();
    console.log('✅ Migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

main();
