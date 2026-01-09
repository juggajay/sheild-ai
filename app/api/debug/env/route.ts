import { NextResponse } from 'next/server'
import { useSupabase } from '@/lib/db/supabase-db'

// Temporary debug endpoint to check env configuration
// REMOVE THIS AFTER DEBUGGING
export async function GET() {
  return NextResponse.json({
    useSupabase: useSupabase(),
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    nodeEnv: process.env.NODE_ENV,
    // Show first few chars of URL to verify it's real (not "test")
    urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) || 'not set'
  })
}
