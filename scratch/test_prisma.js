import prisma from '../src/lib/prisma.js';

async function testPrisma() {
  try {
    console.log('🚀 Testing Prisma connectivity...');
    const profiles = await prisma.userProfile.findMany({
      take: 1
    });
    console.log('✅ Successfully fetched profiles:', profiles);
    
    if (profiles.length > 0) {
      console.log('Bank Account Type:', profiles[0].bankAccountType);
    }
  } catch (err) {
    console.error('❌ Prisma test failed:', err);
  } finally {
    // We can't easily close the proxy-based prisma in a script without access to globalThis._prisma
    process.exit(0);
  }
}

testPrisma();
