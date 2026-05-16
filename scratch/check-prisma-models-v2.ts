import prisma from '../src/lib/prisma.js';

async function main() {
  try {
    console.log('rbacUser exists:', !!prisma.rbacUser);
    console.log('passwordResetToken exists:', !!(prisma as any).passwordResetToken);
  } catch (e: any) {
    console.log('Error accessing models:', e.message);
  }

}

main().catch(console.error);
