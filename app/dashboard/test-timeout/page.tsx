"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { fetchWithTimeout, isTimeoutError } from "@/lib/utils"
import { Loader2, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

type RequestStatus = 'idle' | 'loading' | 'success' | 'timeout' | 'error'

export default function TestTimeoutPage() {
  const { toast } = useToast()
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Test with a short timeout (5 seconds) against a slow API
  const testSlowRequest = async (apiDelay: number, timeout: number) => {
    setStatus('loading')
    setResponseTime(null)
    setErrorMessage(null)
    const startTime = Date.now()

    try {
      const response = await fetchWithTimeout(
        `/api/test/slow?delay=${apiDelay}`,
        { method: 'GET' },
        timeout
      )

      const elapsed = Date.now() - startTime
      setResponseTime(elapsed)

      if (response.ok) {
        setStatus('success')
        toast({
          title: "Request completed",
          description: `Response received in ${elapsed}ms`
        })
      } else {
        setStatus('error')
        setErrorMessage(`Server error: ${response.status}`)
        toast({
          title: "Server error",
          description: `Received status ${response.status}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      const elapsed = Date.now() - startTime
      setResponseTime(elapsed)

      if (isTimeoutError(error)) {
        setStatus('timeout')
        setErrorMessage('The request took too long to complete. Please try again.')
        toast({
          title: "Request timed out",
          description: "The server took too long to respond. You can try again.",
          variant: "destructive"
        })
      } else {
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
        toast({
          title: "Request failed",
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: "destructive"
        })
      }
    }
  }

  const handleQuickRequest = () => testSlowRequest(1000, 5000) // 1s delay, 5s timeout
  const handleSlowRequest = () => testSlowRequest(10000, 5000) // 10s delay, 5s timeout (will timeout)
  const handleRetry = () => testSlowRequest(1000, 5000)

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case 'timeout':
        return <Clock className="h-8 w-8 text-amber-500" />
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />
      default:
        return <AlertTriangle className="h-8 w-8 text-slate-400" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'loading':
        return 'Waiting for response...'
      case 'success':
        return 'Request completed successfully!'
      case 'timeout':
        return 'Request timed out!'
      case 'error':
        return 'Request failed!'
      default:
        return 'Ready to test'
    }
  }

  return (
    <>
      {/* Page Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Timeout Handling Test</h1>
            <p className="text-slate-500">Test how the UI handles slow or timed-out requests</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 md:p-8 lg:p-12 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>API Timeout Testing</CardTitle>
            <CardDescription>
              Test the application&apos;s handling of slow API responses and timeouts.
              The timeout is set to 5 seconds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Display */}
            <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-lg border">
              {getStatusIcon()}
              <p className="mt-4 text-lg font-medium text-slate-900">{getStatusText()}</p>
              {responseTime !== null && (
                <p className="text-sm text-slate-500 mt-1">
                  Response time: {responseTime}ms
                </p>
              )}
              {errorMessage && (
                <p className="text-sm text-red-500 mt-2 text-center max-w-md">
                  {errorMessage}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                onClick={handleQuickRequest}
                disabled={status === 'loading'}
                variant="outline"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Quick Request (1s)
                  </>
                )}
              </Button>

              <Button
                onClick={handleSlowRequest}
                disabled={status === 'loading'}
                variant="destructive"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Slow Request (Will Timeout)
                  </>
                )}
              </Button>

              {(status === 'timeout' || status === 'error') && (
                <Button
                  onClick={handleRetry}
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
            </div>

            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">How it works:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Quick Request</strong>: Simulates a 1-second API call (completes successfully)</li>
                <li>• <strong>Slow Request</strong>: Simulates a 10-second API call with 5-second timeout (will timeout)</li>
                <li>• When a timeout occurs, the UI shows an error and provides a <strong>Retry</strong> option</li>
                <li>• The UI remains responsive during the request - you can interact with other elements</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Responsiveness Test */}
        <Card>
          <CardHeader>
            <CardTitle>UI Responsiveness</CardTitle>
            <CardDescription>
              These buttons should remain clickable even while a request is pending
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => toast({ title: "Button clicked!", description: "The UI is responsive" })}
              >
                Click Me During Request
              </Button>
              <Button
                variant="outline"
                onClick={() => alert("Alert works too!")}
              >
                Show Alert
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
