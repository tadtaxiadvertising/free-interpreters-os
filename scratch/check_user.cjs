const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'deuryd@gmail.com';
  console.log(`Checking user: ${email}`);
  
  try {
    const user = await prisma.rbacUser.findUnique({
      where: { email },
    });
    
    if (!user) {
      console.log('User not found in DB.');
    } else {
      console.log(`User found! ID: ${user.id}, Role: ${user.role}`);
      console.log(`Password hash in DB: ${user.password}`);
    }
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
