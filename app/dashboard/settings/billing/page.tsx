"use client"

import { useState, useEffect, Suspense } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { CreditCard, Check, AlertCircle, ArrowRight, Users, Briefcase, Building2, Rocket, Loader2, Gift, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@/lib/hooks/use-api"
import { PRICING_PLANS, FOUNDER_COUPON, formatPrice, getAnnualSavings, type SubscriptionTier } from "@/lib/stripe/config"

type BillingInterval = 'monthly' | 'annual'

// Wrap the main content in a component that uses useSearchParams
function BillingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: user } = useUser()
  const companyId = user?.company?.id
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  // Get usage limits from Convex
  const usageLimits = useQuery(
    api.companies.getUsageLimits,
    companyId ? { companyId: companyId as any } : "skip"
  )

  // Check for success/cancel params
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true)
      // Clear the params after showing
      setTimeout(() => {
        router.replace('/dashboard/settings/billing')
      }, 3000)
    }
  }, [searchParams, router])

  const [error, setError] = useState<string | null>(null)

  const handleSelectPlan = async (tier: string) => {
    if (tier === 'enterprise') {
      // Open email to sales
      window.location.href = 'mailto:sales@risksure.ai?subject=Enterprise%20Plan%20Inquiry'
      return
    }

    setIsLoading(tier)
    setError(null)
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billingInterval }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create checkout session')
        return
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else if (data.redirectUrl) {
        // Simulated mode
        window.location.href = data.redirectUrl
      } else {
        setError('No checkout URL returned')
      }
    } catch (err) {
      console.error('Failed to create checkout session:', err)
      setError('Network error - please try again')
    } finally {
      setIsLoading(null)
    }
  }

  const handleManageSubscription = async () => {
    setIsLoading('portal')
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('Portal error:', data.error)
      }
    } catch (error) {
      console.error('Failed to create portal session:', error)
    } finally {
      setIsLoading(null)
    }
  }

  const currentTier = usageLimits?.tier || 'trial'
  const isTrialOrFree = ['trial', 'subcontractor'].includes(currentTier)

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Billing & Subscription</h1>
            <p className="text-slate-500">Manage your subscription and payment methods</p>
          </div>
          {!isTrialOrFree && (
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={isLoading === 'portal'}
            >
              {isLoading === 'portal' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Manage Subscription
            </Button>
          )}
        </div>
      </header>

      {/* Billing Content */}
      <div className="p-6 md:p-8 lg:p-12 space-y-8">
        {/* Success Message */}
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <Check className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Subscription Updated Successfully!</p>
              <p className="text-sm text-green-600">Your plan has been updated. Changes are now active.</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
              Dismiss
            </Button>
          </div>
        )}

        {/* Current Plan & Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Current Plan & Usage
            </CardTitle>
            <CardDescription>Your subscription status and resource usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold capitalize">
                    {currentTier === 'trial' ? 'Free Trial' : `${currentTier} Plan`}
                  </h3>
                  <Badge variant={usageLimits?.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
                    {usageLimits?.subscriptionStatus || 'trial'}
                  </Badge>
                </div>
                {currentTier === 'trial' && (
                  <p className="text-sm text-slate-500 mt-1">14-day free trial with Compliance features</p>
                )}
              </div>
              {!isTrialOrFree && (
                <Button variant="outline" onClick={handleManageSubscription}>
                  Change Plan
                </Button>
              )}
            </div>

            {/* Usage Stats */}
            {usageLimits && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <UsageCard
                  icon={<Users className="h-5 w-5 text-blue-500" />}
                  label="Active Vendors"
                  current={usageLimits.vendors.current}
                  limit={usageLimits.vendors.limit}
                  percentUsed={usageLimits.vendors.percentUsed}
                  isNearLimit={usageLimits.vendors.isNearLimit}
                  isAtLimit={usageLimits.vendors.isAtLimit}
                />
                <UsageCard
                  icon={<Briefcase className="h-5 w-5 text-purple-500" />}
                  label="Team Members"
                  current={usageLimits.users.current}
                  limit={usageLimits.users.limit}
                  percentUsed={usageLimits.users.percentUsed}
                  isNearLimit={usageLimits.users.isNearLimit}
                  isAtLimit={usageLimits.users.isAtLimit}
                />
                <UsageCard
                  icon={<Building2 className="h-5 w-5 text-green-500" />}
                  label="Projects"
                  current={usageLimits.projects.current}
                  limit={usageLimits.projects.limit}
                  percentUsed={usageLimits.projects.percentUsed}
                  isNearLimit={usageLimits.projects.isNearLimit}
                  isAtLimit={usageLimits.projects.isAtLimit}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Promo Code Banner */}
        <Card className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Gift className="h-6 w-6" />
                <div>
                  <p className="font-semibold">Founder Special Offer</p>
                  <p className="text-sm text-violet-100">Use code <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded">{FOUNDER_COUPON.code}</span> for {FOUNDER_COUPON.percentOff}% off your first {FOUNDER_COUPON.durationMonths} months!</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-white text-violet-600 hover:bg-white/90">
                Limited Time
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Billing Interval Toggle */}
        <div className="flex items-center justify-center gap-4">
          <Label htmlFor="billing-toggle" className={billingInterval === 'monthly' ? 'font-medium' : 'text-slate-500'}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={billingInterval === 'annual'}
            onCheckedChange={(checked) => setBillingInterval(checked ? 'annual' : 'monthly')}
          />
          <Label htmlFor="billing-toggle" className={billingInterval === 'annual' ? 'font-medium' : 'text-slate-500'}>
            Annual
          </Label>
          {billingInterval === 'annual' && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              Save up to 17%
            </Badge>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(Object.keys(PRICING_PLANS) as Array<keyof typeof PRICING_PLANS>).map((tier) => {
            const plan = PRICING_PLANS[tier]
            const isCurrentPlan = currentTier === tier
            const savings = getAnnualSavings(tier)

            return (
              <PlanCard
                key={tier}
                tier={tier}
                name={plan.name}
                description={plan.description}
                priceMonthly={plan.priceMonthly}
                priceAnnual={plan.priceAnnual}
                billingInterval={billingInterval}
                features={plan.features}
                vendorLimit={plan.vendorLimit}
                userLimit={plan.userLimit}
                projectLimit={plan.projectLimit}
                isCurrent={isCurrentPlan}
                isRecommended={plan.recommended}
                isEnterprise={tier === 'enterprise'}
                savings={savings}
                isLoading={isLoading === tier}
                onSelect={() => handleSelectPlan(tier)}
              />
            )
          })}
        </div>

        {/* Feature Comparison Note */}
        <div className="text-center text-sm text-slate-500">
          <p>All plans include AI-powered document verification, automated expiry monitoring, and email notifications.</p>
          <p className="mt-1">Need help choosing? <a href="mailto:support@risksure.ai" className="text-primary hover:underline">Contact our team</a></p>
        </div>

        {/* FAQ or Additional Info */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium">What counts as an "active vendor"?</h4>
              <p className="text-sm text-slate-500">An active vendor is any subcontractor with at least one active project assignment. Vendors without project assignments don't count toward your limit.</p>
            </div>
            <div>
              <h4 className="font-medium">Can I change plans anytime?</h4>
              <p className="text-sm text-slate-500">Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and you'll be prorated accordingly.</p>
            </div>
            <div>
              <h4 className="font-medium">What happens if I exceed my vendor limit?</h4>
              <p className="text-sm text-slate-500">You'll receive a warning when approaching your limit. Once reached, you'll need to upgrade to add more vendors or remove inactive ones.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function UsageCard({
  icon,
  label,
  current,
  limit,
  percentUsed,
  isNearLimit,
  isAtLimit,
}: {
  icon: React.ReactNode
  label: string
  current: number
  limit: number | null
  percentUsed: number
  isNearLimit: boolean
  isAtLimit: boolean
}) {
  const isUnlimited = limit === null

  return (
    <div className={`p-4 rounded-lg border ${isAtLimit ? 'border-red-200 bg-red-50' : isNearLimit ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{current}</span>
        <span className="text-slate-500">/ {isUnlimited ? 'Unlimited' : limit}</span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percentUsed}
          className={`mt-2 h-2 ${isAtLimit ? '[&>div]:bg-red-500' : isNearLimit ? '[&>div]:bg-amber-500' : ''}`}
        />
      )}
      {isAtLimit && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Limit reached - upgrade to add more
        </p>
      )}
    </div>
  )
}

function PlanCard({
  tier,
  name,
  description,
  priceMonthly,
  priceAnnual,
  billingInterval,
  features,
  vendorLimit,
  userLimit,
  projectLimit,
  isCurrent,
  isRecommended,
  isEnterprise,
  savings,
  isLoading,
  onSelect,
}: {
  tier: string
  name: string
  description: string
  priceMonthly: number
  priceAnnual: number
  billingInterval: BillingInterval
  features: string[]
  vendorLimit: number | null
  userLimit: number | null
  projectLimit: number | null
  isCurrent: boolean
  isRecommended?: boolean
  isEnterprise?: boolean
  savings: number
  isLoading: boolean
  onSelect: () => void
}) {
  const price = billingInterval === 'monthly' ? priceMonthly : priceAnnual
  const perMonth = billingInterval === 'monthly' ? priceMonthly : Math.round(priceAnnual / 12)

  const getIcon = () => {
    switch (tier) {
      case 'velocity': return <Rocket className="h-5 w-5 text-blue-500" />
      case 'compliance': return <Check className="h-5 w-5 text-green-500" />
      case 'business': return <Building2 className="h-5 w-5 text-purple-500" />
      case 'enterprise': return <Briefcase className="h-5 w-5 text-orange-500" />
      default: return null
    }
  }

  return (
    <Card className={`relative flex flex-col ${isRecommended ? 'border-primary border-2 shadow-lg' : ''} ${isCurrent ? 'bg-slate-50' : ''}`}>
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-white">
            Most Popular
          </Badge>
        </div>
      )}
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-2">
          {getIcon()}
          <CardTitle className="text-lg">{name}</CardTitle>
        </div>
        <CardDescription className="text-sm">{description}</CardDescription>
        <div className="mt-4">
          {isEnterprise ? (
            <div>
              <span className="text-3xl font-bold">Custom</span>
              <p className="text-sm text-slate-500 mt-1">Contact sales for pricing</p>
            </div>
          ) : (
            <div>
              <span className="text-3xl font-bold">{formatPrice(perMonth)}</span>
              <span className="text-slate-500">/month</span>
              {billingInterval === 'annual' && (
                <p className="text-sm text-slate-500 mt-1">
                  {formatPrice(price)} billed annually
                </p>
              )}
              {billingInterval === 'annual' && savings > 0 && (
                <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700">
                  Save {formatPrice(savings)}/year
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Users className="h-4 w-4" />
            <span>{vendorLimit === null ? 'Unlimited' : `Up to ${vendorLimit}`} vendors</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Briefcase className="h-4 w-4" />
            <span>{userLimit === null ? 'Unlimited' : `Up to ${userLimit}`} team members</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Building2 className="h-4 w-4" />
            <span>{projectLimit === null ? 'Unlimited' : `Up to ${projectLimit}`} projects</span>
          </div>
        </div>
        <ul className="space-y-2 flex-1">
          {features.slice(3).map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-slate-600">{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          className="w-full mt-4"
          variant={isRecommended ? 'default' : 'outline'}
          disabled={isCurrent || isLoading}
          onClick={onSelect}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processing...
            </>
          ) : isCurrent ? (
            'Current Plan'
          ) : isEnterprise ? (
            <>
              Contact Sales
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              Select Plan
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

// Default export with Suspense boundary for useSearchParams
export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <BillingContent />
    </Suspense>
  )
}
