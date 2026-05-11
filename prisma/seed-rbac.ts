import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const RbacRole = {
  ADMIN: "ADMIN",
  HOLDER: "HOLDER",
  INTERPRETER: "INTERPRETER"
} as any;

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding RBAC Users...");
  const password = await bcrypt.hash("password123", 10);

  // 1. Admin
  const admin = await (prisma as any).rbacUser.upsert({
    where: { email: "admin@freeinterpreters.org" },
    update: { password, role: RbacRole.ADMIN },
    create: {
      email: "admin@freeinterpreters.org",
      name: "System Admin",
      password,
      role: RbacRole.ADMIN,
    },
  });
  console.log(`✅ Admin user created/updated: ${admin.email}`);

  // 2. Holder
  const holder = await (prisma as any).rbacUser.upsert({
    where: { email: "holder@freeinterpreters.org" },
    update: { password, role: RbacRole.HOLDER },
    create: {
      email: "holder@freeinterpreters.org",
      name: "Account Holder",
      password,
      role: RbacRole.HOLDER,
    },
  });
  console.log(`✅ Holder user created/updated: ${holder.email}`);

  // 3. Interpreter
  const interpreter = await (prisma as any).rbacUser.upsert({
    where: { email: "interpreter@freeinterpreters.org" },
    update: { password, role: RbacRole.INTERPRETER },
    create: {
      email: "interpreter@freeinterpreters.org",
      name: "Senior Interpreter",
      password,
      role: RbacRole.INTERPRETER,
    },
  });
  console.log(`✅ Interpreter user created/updated: ${interpreter.email}`);

  console.log("Seed completed successfully. Use password123 to log in.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
