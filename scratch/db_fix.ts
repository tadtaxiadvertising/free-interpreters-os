import prismaClient from '../src/lib/prisma';
const prisma = prismaClient as any;

async function fixDatabase() {
  console.log('🚀 Starting Database Hotfix: Adding bank_account_type column...');
  
  try {
    // Check if column exists first (optional but safer)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS bank_account_type TEXT;
    `);
    
    console.log('✅ Column bank_account_type added successfully to user_profiles table.');
    
    await prisma.$executeRawUnsafe(`
      COMMENT ON COLUMN user_profiles.bank_account_type IS 'Tipo de cuenta bancaria RD: Ahorro o Corriente';
    `);
    
    console.log('✅ Column comment updated.');
    
    // Verify
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_profiles' AND column_name = 'bank_account_type';
    `);
    
    if (columns.length > 0) {
      console.log('✨ Verification successful: Column exists in the database.');
    } else {
      console.error('❌ Verification failed: Column was not found after execution.');
    }

  } catch (error) {
    console.error('❌ Hotfix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDatabase();
