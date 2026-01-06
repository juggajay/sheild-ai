import { NextRequest, NextResponse } from 'next/server'

// Test endpoint that simulates a slow API call
// Used for testing timeout handling in the UI
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const delay = parseInt(searchParams.get('delay') || '5000', 10)

  // Cap delay at 60 seconds for safety
  const actualDelay = Math.min(delay, 60000)

  // Wait for the specified delay
  await new Promise(resolve => setTimeout(resolve, actualDelay))

  return NextResponse.json({
    message: 'Slow response completed',
    delay: actualDelay
  })
}
