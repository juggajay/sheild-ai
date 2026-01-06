import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Shield, FileCheck, Bell, BarChart3 } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-semibold">RiskShield AI</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
            Automate Insurance Compliance for Construction
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            RiskShield AI transforms manual Certificate of Currency verification into an automated system.
            AI-powered document reading, instant compliance checking, and automated broker communications.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Start Free Trial
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Learn More
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div id="features" className="mt-24 grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<FileCheck className="h-8 w-8 text-primary" />}
            title="AI Verification"
            description="GPT-4V extracts and verifies insurance data from any COC format in seconds."
          />
          <FeatureCard
            icon={<Bell className="h-8 w-8 text-primary" />}
            title="Auto Communications"
            description="Deficiency notifications sent directly to brokers with clear fix instructions."
          />
          <FeatureCard
            icon={<BarChart3 className="h-8 w-8 text-primary" />}
            title="Real-Time Dashboard"
            description="Portfolio-wide compliance visibility with drill-down to any project."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-primary" />}
            title="Risk Management"
            description="Exception tracking, audit trails, and stop-work risk alerts."
          />
        </div>

        {/* Stats Section */}
        <div className="mt-24 bg-slate-900 rounded-2xl p-8 md:p-12">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-white mb-2">70%+</div>
              <div className="text-slate-400">Auto-Approval Rate</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">&lt;10s</div>
              <div className="text-slate-400">Verification Time</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">98%</div>
              <div className="text-slate-400">Extraction Accuracy</div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Ready to eliminate rubber-stamping?
          </h2>
          <p className="text-slate-600 mb-8">
            Join head contractors across Australia who trust RiskShield AI for insurance compliance.
          </p>
          <Link href="/signup">
            <Button size="lg">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-24 py-8">
        <div className="container mx-auto px-4 text-center text-slate-500">
          <p>&copy; {new Date().getFullYear()} RiskShield AI. All rights reserved.</p>
          <p className="mt-2 text-sm">Built for the Australian construction industry.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  )
}
