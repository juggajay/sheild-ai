"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Shield, Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const token = searchParams.get("token")
  const type = searchParams.get("type") // 'invitation' or null for magic_link

  const [status, setStatus] = useState<"validating" | "success" | "error">("validating")
  const [errorMessage, setErrorMessage] = useState("")
  const [isInvitation, setIsInvitation] = useState(false)

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setStatus("error")
        setErrorMessage("No magic link token provided")
        return
      }

      try {
        // First validate the token
        const validateUrl = type === 'invitation'
          ? `/api/portal/auth/verify?token=${token}&type=invitation`
          : `/api/portal/auth/verify?token=${token}`
        const validateResponse = await fetch(validateUrl)
        const validateData = await validateResponse.json()

        if (!validateResponse.ok) {
          setStatus("error")
          setErrorMessage(validateData.error || "Invalid or expired link")
          return
        }

        // Then use the token to create a session
        const verifyResponse = await fetch("/api/portal/auth/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ token, type: type || 'magic_link' })
        })

        const verifyData = await verifyResponse.json()

        if (!verifyResponse.ok) {
          setStatus("error")
          setErrorMessage(verifyData.error || "Failed to complete sign in")
          return
        }

        setStatus("success")
        setIsInvitation(verifyData.isInvitation || false)

        toast({
          title: "Welcome!",
          description: verifyData.isInvitation
            ? "You have been signed in. Redirecting to upload your certificate..."
            : "You have been signed in successfully.",
        })

        // Redirect using the URL from the API response
        const redirectUrl = verifyData.redirectUrl || "/portal/dashboard"
        setTimeout(() => {
          router.push(redirectUrl)
        }, 2000)
      } catch (error) {
        setStatus("error")
        setErrorMessage("An error occurred. Please try again.")
      }
    }

    verifyToken()
  }, [token, type, router, toast])

  if (status === "validating") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
            <p className="text-slate-500">Signing you in...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <CardTitle>Invalid Magic Link</CardTitle>
            <CardDescription>
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col space-y-4">
            <Link href="/portal/login" className="w-full">
              <Button className="w-full">
                Request new magic link
              </Button>
            </Link>
            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to home
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Success state
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle>You&apos;re signed in!</CardTitle>
          <CardDescription>
            {isInvitation
              ? "Redirecting you to upload your certificate..."
              : "Redirecting you to the portal dashboard..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="py-4 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function PortalVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
            <p className="text-slate-500">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
