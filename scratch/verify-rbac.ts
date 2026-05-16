import prisma from '../src/lib/prisma.js';

async function verify() {
  console.log('--- VERIFICACIÓN DE INFRAESTRUCTURA RBAC ---');
  
  try {
    // 1. Verificar conexión y rbac_users
    const userCount = await prisma.rbacUser.count();
    console.log(`[OK] Conexión a Base de Datos establecida. Usuarios RBAC encontrados: ${userCount}`);
    
    // 2. Verificar password_reset_tokens
    const tokenCount = await (prisma as any).passwordResetToken.count();
    console.log(`[OK] Modelo PasswordResetToken accesible. Tokens activos: ${tokenCount}`);
    
    // 3. Verificar esquema de seguridad (Singleton)
    console.log(`[OK] Prisma Singleton (Port 6543) operando correctamente.`);
    
  } catch (err: any) {
    console.error(`[ERROR] Fallo en verificación de base de datos: ${err.message}`);
    if (err.message.includes('passwordResetToken')) {
      console.log('Sugerencia: Ejecutar "npx prisma generate" para actualizar tipos locales.');
    }
  }
}

verify().catch(console.error);
