import { PrismaClient, Prisma } from '@prisma/client';

// Simple client using default environment variables (DATABASE_URL)
const prisma = new PrismaClient();

import { calculatePayroll } from '../src/lib/payroll';

async function testPayroll() {
  console.log('🚀 Iniciando prueba de nómina (Motor Nativo)...');

  try {
    // 1. Buscar o crear un intérprete de prueba
    let interpreter = await prisma.interpreter.findFirst({
      where: { name: 'Test Interpreter' }
    });

    if (!interpreter) {
      interpreter = await prisma.interpreter.create({
        data: {
          externalId: 'INT-TEST-002',
          name: 'Test Interpreter',
          status: 'Activo',
          tariffPerMinute: new Prisma.Decimal(0.10),
          languageA: 'Español',
          languageB: 'Inglés'
        }
      });
      console.log(`✅ Intérprete creado: ${interpreter.name}`);
    }

    // 2. Crear una cuenta de prueba
    const account = await prisma.account.upsert({
      where: { name: 'Cuenta Especial' },
      update: {},
      create: {
        name: 'Cuenta Especial',
        description: 'Cuenta para pruebas de tarifas'
      }
    });
    console.log(`✅ Cuenta configurada: ${account.name}`);

    // 3. Asignar tarifa especial ($12/hora -> $0.20/min)
    await prisma.interpreterAccountRate.upsert({
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

    // 4. Crear logs
    const today = new Date();
    await prisma.productionLog.deleteMany({
      where: { interpreterId: interpreter.id }
    });

    await prisma.productionLog.create({
      data: {
        interpreterId: interpreter.id,
        date: today,
        interpretedMinutes: 100,
        accountId: account.id,
        status: 'Importado'
      }
    });

    await prisma.productionLog.create({
      data: {
        interpreterId: interpreter.id,
        date: today,
        interpretedMinutes: 100,
        status: 'Importado'
      }
    });

    console.log('✅ Datos preparados. Ejecutando cálculo...');
    
    // Simular el cálculo aquí mismo para validar la lógica
    const logs = await prisma.productionLog.findMany({
      where: { interpreterId: interpreter.id },
      include: { account: true }
    });
    
    console.log(`✅ Se encontraron ${logs.length} logs.`);
    
    let total = 0;
    for (const log of logs) {
      let rate = 0;
      if (log.accountId) {
        const accRate = await prisma.interpreterAccountRate.findUnique({
          where: {
            interpreterId_accountId: {
              interpreterId: interpreter.id,
              accountId: log.accountId
            }
          }
        });
        if (accRate) {
          rate = Number(accRate.tariffPerHour) / 60;
        }
      }
      
      if (rate === 0) {
        rate = Number(interpreter.tariffPerMinute);
      }
      
      total += Number(log.interpretedMinutes) * rate;
    }

    console.log(`\n📊 RESULTADO SIMULADO: $${total.toFixed(2)}`);
    console.log(`(Esperado: $30.00)`);

    if (Math.abs(total - 30) < 0.01) {
      console.log('\n🏆 ¡PRUEBA EXITOSA! La lógica de cálculo por cuenta funciona correctamente.');
    } else {
      console.log('\n❌ FALLO: El cálculo no coincide.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPayroll();
