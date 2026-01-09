"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Shield, CheckCircle2, AlertTriangle, FileSearch, Lock, Check, XCircle, ArrowRight } from "lucide-react"

export default function LandingPagePreview() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      
      {/* --- NAV --- */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600 fill-blue-600" />
            <span className="text-lg font-bold tracking-tight text-slate-900">RiskShield AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors hidden sm:block">
              Log in
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                Book a Risk Audit
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Copy */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                For Australian Head Contractors
              </div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.1] mb-6">
                Never Let an Uninsured Subcontractor On Your Site.
              </h1>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                RiskShield AI reads the fine print your team misses. We detect missing 
                <span className="font-semibold text-slate-900"> Principal Indemnity</span> clauses, 
                <span className="font-semibold text-slate-900"> Worker-to-Worker</span> exclusions, and unpaid 
                <span className="font-semibold text-slate-900"> WorkCover</span> premiums instantly.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/signup">
                  <Button size="lg" className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white text-lg rounded-full shadow-lg shadow-blue-200 w-full sm:w-auto">
                    Start Free Risk Audit
                  </Button>
                </Link>
                <div className="flex items-center gap-4 px-4 text-sm text-slate-500">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>No credit card required</span>
                </div>
              </div>
            </div>

            {/* Visual: The AI Scanner Animation */}
            <div className="relative mx-auto w-full max-w-[500px] perspective-1000">
              {/* Background Glow */}
              <div className="absolute -inset-4 bg-blue-500/10 blur-3xl rounded-full" />
              
              {/* The "Document" Card */}
              <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform rotate-y-12 rotate-x-6 transition-transform hover:rotate-0 duration-700 group">
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                  </div>
                  <div className="text-xs font-mono text-slate-400">COC_Plumbing_2026.pdf</div>
                </div>
                
                {/* Content Simulation */}
                <div className="p-6 space-y-4 font-mono text-xs text-slate-300 select-none">
                  <div className="h-2 w-3/4 bg-slate-100 rounded" />
                  <div className="h-2 w-1/2 bg-slate-100 rounded" />
                  <div className="h-2 w-full bg-slate-100 rounded" />
                  <div className="h-2 w-5/6 bg-slate-100 rounded" />
                  
                  {/* The Risk Highlight */}
                  <div className="relative p-3 bg-red-50 border border-red-100 rounded-lg mt-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                      <div>
                        <div className="text-red-900 font-bold mb-1 text-[10px] md:text-xs">CRITICAL RISK DETECTED</div>
                        <div className="text-red-700 text-[10px] md:text-xs">
                          Exclusion found: "Cross Liability" clause missing. 
                          <br/>
                          <span className="underline decoration-red-300">Principal Indemnity NOT VALID.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-slate-100 rounded" />
                  <div className="h-2 w-2/3 bg-slate-100 rounded" />
                </div>

                {/* Scan Line Animation (Note: would need tailwind config for custom animation or inline style) */}
                <div 
                  className="absolute top-0 left-0 w-full h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  style={{ animation: 'scan 3s ease-in-out infinite' }}
                />
              </div>
              
              {/* CSS Animation for the scan effect */}
              <style jsx global>{`
                @keyframes scan {
                  0%, 100% { top: 0%; }
                  50% { top: 100%; }
                }
                .perspective-1000 {
                  perspective: 1000px;
                }
                .rotate-y-12 {
                  transform: rotateY(12deg);
                }
                .rotate-x-6 {
                  transform: rotateX(6deg);
                }
              `}</style>
            </div>
          </div>
        </div>
      </section>

      {/* --- THE STAKES (Agitation) --- */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            A "Certificate of Currency" is not enough.
          </h2>
          <p className="text-lg text-slate-600 mb-16 max-w-2xl mx-auto">
            Your admin team checks dates and limits. They don't check the 40-page PDS for exclusions that leave your company liable.
          </p>

          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">The "Deemed Employer" Trap</h3>
              <p className="text-slate-600 text-sm">
                If a sub hasn't paid WorkCover, <strong>you</strong> become the employer when an injury happens. We validate payment status directly with state schemes.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                <FileSearch className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Hidden Exclusions</h3>
              <p className="text-slate-600 text-sm">
                We catch "Welding Exclusions" and "Height Restrictions" buried in the policy wording that generic checks miss.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-slate-200 rounded-xl flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-slate-700" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Industrial Manslaughter</h3>
              <p className="text-slate-600 text-sm">
                "We didn't know" is no longer a legal defense. Demonstrate proactive Duty of Care with an auditable compliance trail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Automated Defense in 3 Steps</h2>
            <p className="text-slate-400">From inbox to "Approved" without human data entry.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-slate-700 z-0" />

            {/* Step 1 */}
            <div className="relative z-10 text-center group">
              <div className="h-24 w-24 mx-auto bg-slate-800 rounded-full border-4 border-slate-900 flex items-center justify-center mb-6 group-hover:border-blue-500 transition-colors">
                <span className="text-3xl font-bold text-blue-500">1</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Auto-Collection</h3>
              <p className="text-slate-400 text-sm px-4">
                We sync with your project email. When a broker emails a COC, RiskShield grabs it instantly.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 text-center group">
              <div className="h-24 w-24 mx-auto bg-slate-800 rounded-full border-4 border-slate-900 flex items-center justify-center mb-6 group-hover:border-blue-500 transition-colors">
                <span className="text-3xl font-bold text-blue-500">2</span>
              </div>
              <h3 className="text-xl font-bold mb-3">AI Audit</h3>
              <p className="text-slate-400 text-sm px-4">
                Our AI checks 25+ data points against <strong>Australian Standards</strong> (AS 4000) and your specific contract requirements.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 text-center group">
              <div className="h-24 w-24 mx-auto bg-slate-800 rounded-full border-4 border-slate-900 flex items-center justify-center mb-6 group-hover:border-blue-500 transition-colors">
                <span className="text-3xl font-bold text-blue-500">3</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Morning Brief</h3>
              <p className="text-slate-400 text-sm px-4">
                Site Managers get a 6 AM alert: "Stop these 2 subs at the gate." Everyone else is green-lit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FEATURES (Australian Specifics) --- */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-16 items-center">
            <div className="w-full md:w-1/2">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">
                Built for Australian Construction.
              </h2>
              <p className="text-lg text-slate-600 mb-8">
                We don't do "General Liability." We do <strong>Public Liability</strong> with state-specific checks.
              </p>
              
              <div className="space-y-4">
                <FeatureRow
                  title="Workers Comp State Matching"
                  desc="Automatic state scheme detection and project location matching for all Australian states."
                />
                <FeatureRow 
                  title="Principal Indemnity Verification" 
                  desc="Ensures your company is explicitly named and covered." 
                />
                <FeatureRow 
                  title="APRA License Check" 
                  desc="Flag unauthorized foreign insurers instantly." 
                />
                <FeatureRow 
                  title="ABN/ACN Match" 
                  desc="Stop the 'Phoenix Company' risk where the insured entity doesn't match the contract." 
                />
              </div>
            </div>
            
            <div className="w-full md:w-1/2">
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                  <div className="font-bold text-slate-900">Morning Brief • Jan 10</div>
                  <div className="text-xs font-mono text-slate-400">6:00 AM</div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-red-50 text-red-900 rounded-lg border border-red-100">
                    <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                    <div>
                      <div className="font-bold text-sm">STOP WORK: Apex Concreting</div>
                      <div className="text-xs opacity-80">Policy Expired Yesterday. Do not admit to site.</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-3 bg-amber-50 text-amber-900 rounded-lg border border-amber-100">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-bold text-sm">WARNING: Smith Electrical</div>
                      <div className="text-xs opacity-80">Coverage too low ($10M vs $20M req). Exception pending.</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-3 bg-green-50 text-green-900 rounded-lg border border-green-100">
                    <Check className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <div className="font-bold text-sm">APPROVED: 14 Subcontractors</div>
                      <div className="text-xs opacity-80">All docs valid and filed.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FAQ --- */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
            Common Questions
          </h2>
          
          <div className="space-y-4">
            <FaqItem 
              question="Is this just OCR?" 
              answer="No. OCR just reads text. RiskShield uses Large Language Models (LLMs) to understand legal context. We know that 'Not covered for excavation > 2m' is a dealbreaker for your civil project, even if the policy dates are valid."
            />
            <FaqItem 
              question="Does it replace our broker?" 
              answer="No, it helps them. We send your broker a clear, itemized list of what needs to be fixed (e.g., 'Please add Principal Indemnity clause 4.2'), saving days of back-and-forth emails."
            />
            <FaqItem 
              question="Which insurers do you support?" 
              answer="All major Australian insurers (QBE, Allianz, CGU, Zurich, etc.) and most international underwriters. Our system learns new formats instantly."
            />
            <FaqItem 
              question="Is my data secure?" 
              answer="Yes. We use enterprise-grade encryption and host all data in Australia (Sydney region) to comply with data sovereignty requirements."
            />
          </div>
        </div>
      </section>

      {/* --- CLOSER --- */}
      <section className="py-24 bg-blue-600 text-white text-center">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Don't wait for an incident to find your gaps.
          </h2>
          <p className="text-xl text-blue-100 mb-10">
            Join the forward-thinking builders who sleep soundly.
          </p>
          <Link href="/signup">
            <Button size="lg" className="h-16 px-10 bg-white text-blue-600 hover:bg-blue-50 text-xl font-bold rounded-full shadow-2xl transition-transform hover:scale-105">
              Get Your Free Risk Audit
            </Button>
          </Link>
          <p className="mt-6 text-sm text-blue-200">
            Full setup in &lt;15 minutes. No software to install.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t py-12">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-slate-400" />
            <span className="font-bold text-slate-400">RiskShield AI</span>
          </div>
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} RiskShield AI. Built for the Australian Construction Industry.
          </p>
        </div>
      </footer>

    </div>
  )
}

function FeatureRow({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
        <Check className="h-4 w-4 text-blue-600" />
      </div>
      <div>
        <h3 className="font-bold text-slate-900">{title}</h3>
        <p className="text-slate-600 text-sm">{desc}</p>
      </div>
    </div>
  )
}

function FaqItem({ question, answer }: { question: string, answer: string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-6 hover:border-blue-200 transition-colors group cursor-pointer">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{question}</h3>
        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all" />
      </div>
      <p className="text-slate-600 text-sm leading-relaxed">{answer}</p>
    </div>
  )
}
