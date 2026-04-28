import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('Testing connection to Supabase API...')
  console.log('URL:', supabaseUrl)
  
  // Try to fetch something public or check status
  const { data, error } = await supabase.from('interpreters').select('*').limit(1)
  
  if (error) {
    if (error.code === 'PGRST116') {
      console.log('✅ Connection successful, but table "interpreters" does not exist yet.')
    } else {
      console.error('❌ Error connecting to API:', error.message)
    }
  } else {
    console.log('✅ Connection successful! Data:', data)
  }
}

testConnection()
