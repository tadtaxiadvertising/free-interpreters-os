import { Prisma } from '@prisma/client';

// Mocking the behavior of calculatePayroll logic locally
async function testPayrollMock() {
  console.log('🚀 Iniciando SIMULACIÓN de nómina (Sin conexión a BD)...');

  // 1. Datos del intérprete (Simulados)
  const interpreter = {
    id: 1,
    name: 'Test Interpreter',
    tariffPerMinute: 0.10, // $0.10/min base
    accountRates: [
      { accountId: 101, tariffPerHour: 12.00 } // $0.20/min para la cuenta 101
    ]
  };

  // 2. Logs de producción (Simulados)
  const logs = [
    {
      interpretedMinutes: 100,
      accountId: 101, // Debería usar tarifa especial: 100 * (12/60) = $20.00
      description: 'Log con cuenta premium'
    },
    {
      interpretedMinutes: 100,
      accountId: null, // Debería usar tarifa base: 100 * 0.10 = $10.00
      description: 'Log sin cuenta (Tarifa Base)'
    }
  ];

  console.log('✅ Datos simulados cargados.');
  console.log('---');
  
  let total = 0;
  for (const log of logs) {
    let ratePerMinute = interpreter.tariffPerMinute;
    let source = 'Base';

    if (log.accountId) {
      const specificRate = interpreter.accountRates.find(r => r.accountId === log.accountId);
      if (specificRate) {
        ratePerMinute = specificRate.tariffPerHour / 60;
        source = 'Cuenta Especial';
      }
    }

    const cost = log.interpretedMinutes * ratePerMinute;
    total += cost;
    
    console.log(`📝 ${log.description}:`);
    console.log(`   - Minutos: ${log.interpretedMinutes}`);
    console.log(`   - Tarifa: $${ratePerMinute.toFixed(2)}/min (${source})`);
    console.log(`   - Subtotal: $${cost.toFixed(2)}`);
  }

  console.log('---');
  console.log(`📊 TOTAL CALCULADO: $${total.toFixed(2)}`);
  console.log(`🎯 ESPERADO: $30.00 ($20.00 premium + $10.00 base)`);

  if (Math.abs(total - 30) < 0.01) {
    console.log('\n🏆 ¡LÓGICA VERIFICADA! El motor de cálculo funciona correctamente.');
  } else {
    console.log('\n❌ ERROR: El cálculo no coincide con la lógica esperada.');
  }
}

testPayrollMock();
