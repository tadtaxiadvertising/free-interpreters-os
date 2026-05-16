const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.rbacUser.findMany({
      select: { email: true },
      take: 20
    });
    console.log('Registered emails:');
    users.forEach(u => console.log(` - ${u.email}`));
  } catch (err) {
    console.error('Error fetching users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
