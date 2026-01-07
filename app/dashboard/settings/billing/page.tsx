"use client"

import { CreditCard, Check, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function BillingPage() {
  // This page is only accessible to admins (enforced by layout)

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Billing & Subscription</h1>
            <p className="text-slate-500">Manage your subscription and payment methods</p>
          </div>
        </div>
      </header>

      {/* Billing Content */}
      <div className="p-6 md:p-8 lg:p-12 space-y-6">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Current Plan
            </CardTitle>
            <CardDescription>Your active subscription details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Trial Plan</h3>
                  <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                    Trial
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">14 days remaining</p>
              </div>
              <Button>Upgrade Plan</Button>
            </div>
          </CardContent>
        </Card>

        {/* Available Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PlanCard
            name="Starter"
            price="$99"
            period="per month"
            description="For small teams getting started"
            features={[
              "Up to 5 projects",
              "100 subcontractors",
              "Email support",
              "Basic reporting"
            ]}
            current={false}
          />
          <PlanCard
            name="Professional"
            price="$299"
            period="per month"
            description="For growing construction companies"
            features={[
              "Unlimited projects",
              "500 subcontractors",
              "Priority support",
              "Advanced analytics",
              "API access"
            ]}
            current={false}
            recommended
          />
          <PlanCard
            name="Enterprise"
            price="Custom"
            period="pricing"
            description="For large organizations"
            features={[
              "Unlimited everything",
              "Dedicated support",
              "Custom integrations",
              "SSO/SAML",
              "SLA guarantee"
            ]}
            current={false}
          />
        </div>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>Add a payment method to upgrade your plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 border border-dashed rounded-lg">
              <AlertCircle className="h-5 w-5 text-slate-400" />
              <div className="flex-1">
                <p className="text-sm text-slate-600">No payment method on file</p>
                <p className="text-xs text-slate-400">Add a credit card to upgrade your subscription</p>
              </div>
              <Button variant="outline">Add Payment Method</Button>
            </div>
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>Your past invoices and payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-slate-500">
              <CreditCard className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>No billing history</p>
              <p className="text-sm">Invoices will appear here once you upgrade</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function PlanCard({
  name,
  price,
  period,
  description,
  features,
  current,
  recommended
}: {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  current: boolean
  recommended?: boolean
}) {
  return (
    <Card className={`relative ${recommended ? 'border-primary shadow-lg' : ''}`}>
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-full">
            Recommended
          </span>
        </div>
      )}
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="mt-2">
          <span className="text-3xl font-bold">{price}</span>
          <span className="text-slate-500 text-sm"> {period}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              {feature}
            </li>
          ))}
        </ul>
        <Button
          className="w-full mt-4"
          variant={recommended ? 'default' : 'outline'}
          disabled={current}
        >
          {current ? 'Current Plan' : 'Select Plan'}
        </Button>
      </CardContent>
    </Card>
  )
}
