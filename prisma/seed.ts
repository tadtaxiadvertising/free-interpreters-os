import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
console.log('Connecting to:', connectionString ? 'URL present' : 'MISSING URL');
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Interpreters
  const interpreters = [
    {
      externalId: 'INT-001',
      name: 'Arismendy Rodriguez',
      status: 'Activo',
      campaign: 'Medical',
      languageA: 'Español',
      languageB: 'Inglés',
      tariffPerMinute: 0.15,
      pais: 'Dominican Republic',
      metodoPago: 'PayPal',
      emailCorporativo: 'arismendy@freeinterpreters.com'
    },
    {
      externalId: 'INT-002',
      name: 'Sofia Martinez',
      status: 'Activo',
      campaign: 'Legal',
      languageA: 'Español',
      languageB: 'Inglés',
      tariffPerMinute: 0.18,
      pais: 'Mexico',
      metodoPago: 'Bank Transfer'
    },
    {
      externalId: 'INT-003',
      name: 'John Doe',
      status: 'Probation',
      campaign: 'Customer Service',
      languageA: 'Español',
      languageB: 'Inglés',
      tariffPerMinute: 0.12,
      pais: 'Colombia',
      metodoPago: 'Payoneer'
    },
    {
      externalId: 'INT-004',
      name: 'Elena Gilbert',
      status: 'Inactivo',
      campaign: 'Medical',
      languageA: 'Español',
      languageB: 'Inglés',
      tariffPerMinute: 0.15,
      pais: 'USA',
      metodoPago: 'USDT'
    }
  ];

  for (const int of interpreters) {
    await prisma.interpreter.upsert({
      where: { externalId: int.externalId },
      update: {},
      create: int,
    });
  }

  // 2. Recruitment Candidates
  const candidates = [
    {
      name: 'Marcos Peña',
      email: 'marcos@example.com',
      status: 'Aplicante',
      pais: 'Dominican Republic',
      englishLevel: 'C1',
      fechaPostulacion: new Date('2026-04-20'),
    },
    {
      name: 'Laura Garcia',
      email: 'laura@example.com',
      status: 'Entrevista',
      pais: 'Argentina',
      englishLevel: 'C2',
      resultRoleplay: 85,
      fechaPostulacion: new Date('2026-04-18'),
    },
    {
      name: 'Ricardo Fort',
      email: 'ricardo@example.com',
      status: 'Contratado',
      pais: 'Argentina',
      englishLevel: 'C1',
      resultRoleplay: 92,
      fechaPostulacion: new Date('2026-04-10'),
    },
    {
      name: 'Bad Bunny',
      email: 'benito@example.com',
      status: 'Rechazado',
      pais: 'Puerto Rico',
      englishLevel: 'B2',
      resultRoleplay: 45,
      fechaPostulacion: new Date('2026-04-15'),
    }
  ];

  for (const cand of candidates) {
    await prisma.recruitmentCandidate.upsert({
      where: { email: cand.email },
      update: {},
      create: cand,
    });
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
