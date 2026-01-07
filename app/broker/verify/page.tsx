"use client"

import { Suspense } from "react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Shield, Loader2, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

function BrokerVerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [error, setError] = useState("")

  useEffect(() => {
    const token = searchParams.get("token")

    if (!token) {
      setError("Invalid or missing magic link token")
      return
    }

    // Verify the token
    async function verifyToken() {
      try {
        const response = await fetch("/api/broker/auth/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ token })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to verify magic link")
        }

        toast({
          title: "Welcome!",
          description: "You've been signed in successfully.",
        })

        router.push("/broker/dashboard")
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to verify magic link"
        setError(message)
        toast({
          title: "Error",
          description: message,
          variant: "destructive"
        })
      }
    }

    verifyToken()
  }, [searchParams, router, toast])

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="h-16 w-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Verification Failed</h1>
          <p className="text-slate-600 mb-4">{error}</p>
          <a href="/broker/login" className="text-primary hover:underline">
            Request a new magic link
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center">
        <Shield className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
        <p className="text-slate-600">Signing you in...</p>
      </div>
    </div>
  )
}

export default function BrokerVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    }>
      <BrokerVerifyContent />
    </Suspense>
  )
}
