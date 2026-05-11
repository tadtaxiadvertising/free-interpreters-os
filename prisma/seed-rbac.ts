import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

async function main() {
  console.log('🚀 Iniciando aprovisionamiento de Admin RBAC...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no definida en el entorno.');
  }

  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });
  
  const adapter = new PrismaPg(pool);
  
  // Cast to any for the initialization to avoid IDE-sync lag with newly generated types
  const prisma = new PrismaClient({ adapter }) as any;

  try {
    const adminEmail = 'admin@freeinterpreters.com';
    const hashedPassword = await bcrypt.hash('AdminRBAC2026!', 12);

    // Using the rbacUser model generated in schema.prisma
    const admin = await prisma.rbacUser.upsert({
      where: { email: adminEmail },
      update: {
        password: hashedPassword,
      },
      create: {
        email: adminEmail,
        name: 'Administrador Maestro',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });

    console.log(`✅ Admin creado/actualizado: ${admin.email}`);
    console.log('⚠️  RECUERDA: Cambia esta contraseña inmediatamente después del primer login.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  });
