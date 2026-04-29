import prisma from '../src/lib/prisma';
import { calculatePayroll } from '../src/lib/payroll';
import { Prisma } from '@prisma/client';

async function testPayroll() {
  console.log('🚀 Iniciando prueba de nómina con tarifas por cuenta...');

  try {
    // 1. Buscar o crear un intérprete de prueba
    let interpreter = await prisma.interpreter.findFirst({
      where: { name: 'Test Interpreter' }
    });

    if (!interpreter) {
      interpreter = await prisma.interpreter.create({
        data: {
          externalId: 'INT-TEST-001',
          name: 'Test Interpreter',
          status: 'Activo',
          tariffPerMinute: new Prisma.Decimal(0.10), // Tarifa base: $0.10/min ($6/hora)
          languageA: 'Español',
          languageB: 'Inglés'
        }
      });
      console.log(`✅ Intérprete creado: ${interpreter.name}`);
    }

    // 2. Crear una cuenta de prueba
    const account = await prisma.account.upsert({
      where: { name: 'Cuenta Premium' },
      update: {},
      create: {
        name: 'Cuenta Premium',
        description: 'Cuenta para pruebas de tarifas especiales'
      }
    });
    console.log(`✅ Cuenta configurada: ${account.name}`);

    // 3. Asignar tarifa especial para esta cuenta ($12/hora -> $0.20/min)
    const specialRate = await prisma.interpreterAccountRate.upsert({
      where: {
        interpreterId_accountId: {
          interpreterId: interpreter.id,
          accountId: account.id
        }
      },
      update: { tariffPerHour: new Prisma.Decimal(12.00) },
      create: {
        interpreterId: interpreter.id,
        accountId: account.id,
        tariffPerHour: new Prisma.Decimal(12.00)
      }
    });
    console.log(`✅ Tarifa especial asignada: $${specialRate.tariffPerHour}/hora ($0.20/min)`);

    // 4. Crear logs de producción para el período actual
    const today = new Date();
    const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const periodEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Limpiar logs previos del test para no duplicar
    await prisma.productionLog.deleteMany({
      where: {
        interpreterId: interpreter.id,
        date: { gte: periodStart, lte: periodEnd }
      }
    });

    // Log 1: Con cuenta premium (debería usar $0.20/min)
    await prisma.productionLog.create({
      data: {
        interpreterId: interpreter.id,
        date: today,
        interpretedMinutes: 100, // 100 * 0.20 = $20.00
        accountId: account.id,
        status: 'Importado'
      }
    });

    // Log 2: Sin cuenta (debería usar tarifa base $0.10/min)
    await prisma.productionLog.create({
      data: {
        interpreterId: interpreter.id,
        date: today,
        interpretedMinutes: 100, // 100 * 0.10 = $10.00
        status: 'Importado'
      }
    });

    console.log('✅ Logs de producción creados (100 min Premium, 100 min Base)');

    // 5. Calcular nómina
    console.log('Calculating payroll...');
    const result = await calculatePayroll({
      interpreterId: interpreter.id,
      periodStart,
      periodEnd
    });

    console.log('\n📊 RESULTADOS DEL CÁLCULO:');
    console.log('---------------------------');
    console.log(`Total Minutos: ${result.totalMinutes}`);
    console.log(`Gross Total (Bruto): $${result.grossTotal}`);
    console.log(`(Esperado: $20.00 + $10.00 = $30.00)`);
    
    if (result.grossTotal === 30) {
      console.log('\n🏆 ¡PRUEBA EXITOSA! El motor aplicó correctamente las tarifas por cuenta.');
    } else {
      console.log(`\n❌ ERROR: El cálculo bruto ($${result.grossTotal}) no coincide con lo esperado ($30.00).`);
    }

  } catch (error: any) {
    console.error('❌ Error durante la prueba:', error);
    if (error.cause) {
      console.error('🔍 Causa raíz:', JSON.stringify(error.cause, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

testPayroll();
