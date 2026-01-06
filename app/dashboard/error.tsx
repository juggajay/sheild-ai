'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Dashboard error:', error)
  }, [error])

  // Check if it's a network error
  const isNetworkError =
    error.message?.toLowerCase().includes('network') ||
    error.message?.toLowerCase().includes('fetch') ||
    error.message?.toLowerCase().includes('failed to load') ||
    error.message?.toLowerCase().includes('connection') ||
    error.name === 'TypeError'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          {isNetworkError ? (
            <WifiOff className="w-8 h-8 text-red-600" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-red-600" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isNetworkError ? 'Connection Problem' : 'Something went wrong'}
        </h1>

        <p className="text-gray-600 mb-6">
          {isNetworkError
            ? "We're having trouble connecting to the server. Please check your internet connection and try again."
            : "We encountered an unexpected error. Our team has been notified and is working to fix the issue."
          }
        </p>

        <div className="space-y-3">
          <Button
            onClick={() => reset()}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>

          <Link href="/dashboard">
            <Button variant="outline" className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
              Technical Details (dev only)
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-32 text-gray-700">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
