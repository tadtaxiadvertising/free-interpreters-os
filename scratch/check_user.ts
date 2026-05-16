import { config } from 'dotenv';
config();

import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'deuryd@gmail.com';
  console.log(`Checking user: ${email}`);
  console.log(`DB URL: ${process.env.DATABASE_URL?.substring(0, 15)}...`);
  
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
