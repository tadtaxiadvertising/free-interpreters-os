import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testConnection() {
  console.log('\n--- 🔍 Supabase Connectivity Audit ---')
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERROR: Missing environment variables.')
    console.log('Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const start = Date.now()

  try {
    console.log(`📡 Connecting to: ${supabaseUrl}...`)
    
    // Testing specific health check on user_profiles or interpreters
    const { data, error, status } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)

    const duration = Date.now() - start

    if (error) {
      // PGRST116 means record not found, which is fine for a connection test
      // 42P01 means table does not exist
      if (error.code === '42P01') {
        console.warn('⚠️  Table "user_profiles" not found. Check if migrations were run.')
      } else {
        throw error
      }
    }

    console.log('✅ API Connection: STABLE')
    console.log(`⏱️  Latency: ${duration}ms`)
    console.log(`📊 HTTP Status: ${status}`)
    console.log('---------------------------------------\n')

  } catch (err: any) {
    console.error('❌ CRITICAL ERROR: Connection Failed')
    console.error('Message:', err.message || err)
    console.log('Check your Supabase project status and Vercel IP white-listing if applicable.')
    process.exit(1)
  }
}

testConnection()

