'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  // Check if it's a network error
  const isNetworkError =
    error.message?.toLowerCase().includes('network') ||
    error.message?.toLowerCase().includes('fetch') ||
    error.message?.toLowerCase().includes('failed to load') ||
    error.message?.toLowerCase().includes('connection') ||
    error.name === 'TypeError'

  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          padding: '1rem',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <div style={{
              margin: '0 auto 1.5rem',
              width: '4rem',
              height: '4rem',
              backgroundColor: '#fee2e2',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isNetworkError ? (
                <WifiOff style={{ width: '2rem', height: '2rem', color: '#dc2626' }} />
              ) : (
                <AlertTriangle style={{ width: '2rem', height: '2rem', color: '#dc2626' }} />
              )}
            </div>

            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '0.5rem'
            }}>
              {isNetworkError ? 'Connection Problem' : 'Something went wrong'}
            </h1>

            <p style={{
              color: '#4b5563',
              marginBottom: '1.5rem'
            }}>
              {isNetworkError
                ? "We're having trouble connecting to the server. Please check your internet connection and try again."
                : "We encountered an unexpected error. Please try again."
              }
            </p>

            <button
              onClick={() => reset()}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <RefreshCw style={{ width: '1rem', height: '1rem' }} />
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
