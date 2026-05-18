import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getPrisma } from '../src/lib/prisma';

const RbacRole = {
  ADMIN: "ADMIN",
  HOLDER: "HOLDER",
  INTERPRETER: "INTERPRETER"
} as any;

const prisma = getPrisma();

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

  // 1b. Admin interpretersfree@gmail.com
  const primaryAdmin = await (prisma as any).rbacUser.upsert({
    where: { email: "interpretersfree@gmail.com" },
    update: { password, role: RbacRole.ADMIN },
    create: {
      email: "interpretersfree@gmail.com",
      name: "Administrador Titular",
      password,
      role: RbacRole.ADMIN,
    },
  });
  console.log(`✅ Admin user created/updated: ${primaryAdmin.email}`);

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

  // 3. Interpreter General
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

  // 4. Deury Interpreter
  const deury = await (prisma as any).rbacUser.upsert({
    where: { email: "deury@freeinterpreters.com" },
    update: { password, role: RbacRole.INTERPRETER },
    create: {
      email: "deury@freeinterpreters.com",
      name: "Deury Interpreter",
      password,
      role: RbacRole.INTERPRETER,
    },
  });
  console.log(`✅ Interpreter user created/updated: ${deury.email}`);

  // 5. Melvin Interpreter
  const melvin = await (prisma as any).rbacUser.upsert({
    where: { email: "melvin@freeinterpreters.com" },
    update: { password, role: RbacRole.INTERPRETER },
    create: {
      email: "melvin@freeinterpreters.com",
      name: "Melvin Interpreter",
      password,
      role: RbacRole.INTERPRETER,
    },
  });
  console.log(`✅ Interpreter user created/updated: ${melvin.email}`);

  // 6. Isaac Interpreter
  const isaac = await (prisma as any).rbacUser.upsert({
    where: { email: "isaac@freeinterpreters.com" },
    update: { password, role: RbacRole.INTERPRETER },
    create: {
      email: "isaac@freeinterpreters.com",
      name: "Isaac Interpreter",
      password,
      role: RbacRole.INTERPRETER,
    },
  });
  console.log(`✅ Interpreter user created/updated: ${isaac.email}`);

  // 7. Miguel Interpreter
  const miguel = await (prisma as any).rbacUser.upsert({
    where: { email: "miguel@freeinterpreters.com" },
    update: { password, role: RbacRole.INTERPRETER },
    create: {
      email: "miguel@freeinterpreters.com",
      name: "Miguel Interpreter",
      password,
      role: RbacRole.INTERPRETER,
    },
  });
  console.log(`✅ Interpreter user created/updated: ${miguel.email}`);

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
