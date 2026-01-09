import Link from "next/link"
import { 
  Shield, 
  ArrowRight, 
  PlayCircle, 
  Lock, 
  LayoutDashboard, 
  Building2, 
  Users, 
  AlertCircle, 
  Siren, 
  FileWarning, 
  Gavel, 
  Check 
} from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 overflow-x-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 grid-bg opacity-[0.07]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/20 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-lg opacity-40"></div>
              <Shield className="relative h-6 w-6 text-blue-500 fill-blue-500/20" />
            </div>
            <span className="font-bold text-xl tracking-tight">RiskShield<span className="text-slate-500">.ai</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <Link href="#" className="hover:text-white transition-colors">Platform</Link>
            <Link href="#" className="hover:text-white transition-colors">Intelligence</Link>
            <Link href="#" className="hover:text-white transition-colors">Enterprise</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors hidden sm:block">Login</Link>
            <Link href="/signup" className="group relative px-6 py-2.5 bg-white text-slate-950 rounded-full font-semibold text-sm hover:bg-slate-200 transition-all overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                Get Audit
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white via-slate-200 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel-light border border-blue-500/30 text-blue-400 text-xs font-mono mb-8 animate-fade-in-up">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              ACTIVE THREAT DETECTION FOR HEAD CONTRACTORS
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500">Firewall</span> for your <br />
              Jobsite Compliance.
            </h1>
            
            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Stop uninsured subcontractors at the gate. We use military-grade AI to detect <span className="text-white font-medium">Principal Indemnity exclusions</span> and <span class="text-white font-medium">unpaid WorkCover</span> hidden in the fine print.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-lg transition-all shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_-10px_rgba(37,99,235,0.6)] flex items-center justify-center">
                Start Risk Scan
              </Link>
              <button className="w-full sm:w-auto px-8 py-4 glass-panel text-white hover:bg-white/5 rounded-lg font-medium text-lg transition-all flex items-center justify-center gap-2">
                <PlayCircle className="h-5 w-5 text-slate-400" />
                Watch Demo
              </button>
            </div>
          </div>

          {/* Interface Mockup */}
          <div className="relative max-w-6xl mx-auto perspective-[2000px]">
            {/* Glow behind */}
            <div className="absolute -inset-10 bg-gradient-to-t from-blue-600/20 to-transparent blur-3xl opacity-50 rounded-[40px]"></div>
            
            {/* Main Dashboard Card */}
            <div className="relative glass-panel rounded-xl border border-white/10 shadow-2xl overflow-hidden transform md:rotate-x-[15deg] transition-transform duration-1000 hover:rotate-x-[5deg]">
              
              {/* Window Controls */}
              <div className="h-12 border-b border-white/10 flex items-center px-4 justify-between bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-slate-700"></div>
                  <div className="h-3 w-3 rounded-full bg-slate-700"></div>
                  <div className="h-3 w-3 rounded-full bg-slate-700"></div>
                </div>
                <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  secure_connection_established
                </div>
              </div>

              <div className="flex h-[500px]">
                {/* Sidebar */}
                <div className="w-64 border-r border-white/5 bg-slate-900/50 p-4 hidden md:block">
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Portfolio</div>
                      <div className="flex items-center gap-3 px-3 py-2 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20">
                        <LayoutDashboard className="h-4 w-4" />
                        <span className="text-sm font-medium">Morning Brief</span>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-white/5 rounded-md transition-colors">
                        <Building2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Projects (12)</span>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-white/5 rounded-md transition-colors">
                        <Users className="h-4 w-4" />
                        <span className="text-sm font-medium">Subcontractors</span>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/10">
                      <div className="text-xs font-bold text-red-400 mb-1">CRITICAL ALERT</div>
                      <p className="text-[10px] text-red-300/70 leading-relaxed">
                        3 subcontractors on-site today with expired policies.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 bg-slate-950/80 p-6 md:p-8 overflow-hidden relative">
                  {/* Background Grid in Dashboard */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

                  <div className="relative z-10 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-2xl font-bold">Morning Briefing</h3>
                        <p className="text-slate-400 text-sm">Friday, January 9 • 06:00 AM Scan Complete</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">SYSTEM ONLINE</span>
                        <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono">v2.4.0</span>
                      </div>
                    </div>

                    {/* AI Document Scanner Visualization */}
                    <div className="relative flex-1 rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden flex flex-col md:flex-row">
                      
                      {/* Document Preview (Left) */}
                      <div className="flex-1 p-8 relative">
                        <div className="absolute top-4 right-4 text-xs font-mono text-slate-600">ID: COC-2026-X99</div>
                        
                        {/* Document Content Simulation */}
                        <div className="space-y-6 max-w-md relative z-10">
                          {/* Section 1 */}
                          <div className="animate-reveal-data">
                            <div className="h-2 w-24 bg-slate-800 rounded mb-2"></div>
                            <div className="flex items-center gap-3">
                              <div className="h-3 w-48 bg-slate-700 rounded"></div>
                              <div className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono rounded">
                                ✓ VALID_ENTITY
                               </div>
                            </div>
                          </div>

                          {/* Section 2 */}
                          <div className="animate-reveal-data [animation-delay:0.2s]">
                            <div className="h-2 w-32 bg-slate-800 rounded mb-2"></div>
                            <div className="h-3 w-3/4 bg-slate-700 rounded"></div>
                            <div className="h-3 w-1/2 bg-slate-700 rounded mt-2"></div>
                          </div>

                          {/* Section 3 (The Risk) */}
                          <div className="pt-4 animate-reveal-risk">
                            <div className="h-2 w-20 bg-slate-800 rounded mb-2"></div>
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="h-3 w-40 bg-red-400/30 rounded"></div>
                                <div className="text-[10px] text-red-400 font-mono">Principal Indemnity Missing</div>
                              </div>
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            </div>
                          </div>
                        </div>

                        {/* The AI Orb (Subtle Tracer) */}
                        <div className="absolute inset-0 z-20 pointer-events-none">
                          <div className="absolute h-3 w-3 bg-blue-400 rounded-full blur-[4px] shadow-[0_0_15px_rgba(59,130,246,1)] animate-orb-trace"></div>
                        </div>

                        {/* Subtle White Flash Overlay */}
                        <div className="absolute inset-0 z-30 pointer-events-none animate-ai-flash"></div>
                      </div>

                      {/* Analysis Log (Right) */}
                      <div className="w-72 border-l border-white/5 bg-slate-950/30 p-4 font-mono text-xs hidden md:block">
                        <div className="text-slate-500 mb-4 pb-2 border-b border-white/5">Execution Log</div>
                        <div className="space-y-3">
                          <div className="flex gap-2 text-emerald-500 animate-reveal-data">
                            <span>{'>'}</span>
                            <span className="text-emerald-300">Entity: Verified</span>
                          </div>
                          <div className="flex gap-2 text-emerald-500 animate-reveal-data [animation-delay:0.1s]">
                            <span>{'>'}</span>
                            <span className="text-emerald-300">Limit: $20,000,000 OK</span>
                          </div>
                          <div className="flex gap-2 text-red-500 animate-reveal-data [animation-delay:0.3s]">
                            <span>{'>'}</span>
                            <span className="text-red-400">Risk: Indemnity Breach</span>
                          </div>
                          <div className="mt-4 p-2 bg-slate-800 rounded text-slate-400 animate-reveal-data [animation-delay:0.4s]">
                            Status: <span className="text-red-400 font-bold">REJECTED</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem (Bento Grid) */}
      <section className="py-24 bg-slate-900/50 border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">The "Corporate Veil" is thinner than you think.</h2>
            <p className="text-slate-400">Manual verification leaves you exposed to 3 catastrophic risks.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="group glass-panel p-8 rounded-2xl hover:bg-white/5 transition-all duration-500 hover:-translate-y-1">
              <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Siren className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">Deemed Employer Liability</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                If a subcontractor hasn't paid their WorkCover, <span className="text-white">you become the employer</span> when an injury happens. We check payment status directly with state schemes.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group glass-panel p-8 rounded-2xl hover:bg-white/5 transition-all duration-500 hover:-translate-y-1">
              <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FileWarning className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">The "Welding" Exclusion</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                A $20M policy is worthless if it excludes "Hot Work." Our AI reads the 40-page PDS to find specific exclusions relevant to your trade.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group glass-panel p-8 rounded-2xl hover:bg-white/5 transition-all duration-500 hover:-translate-y-1">
              <div className="h-12 w-12 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Gavel className="h-6 w-6 text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">Industrial Manslaughter</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                Legislation in QLD and VIC puts directors in jail for negligence. An auditable, AI-verified paper trail is your best defense.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Specs */}
      <section className="py-24 relative overflow-hidden">
        {/* Decoration */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 h-full bg-gradient-to-l from-blue-900/10 to-transparent"></div>

        <div className="container mx-auto px-6 flex flex-col md:flex-row gap-16 items-center">
          <div className="w-full md:w-1/2">
            <div className="text-blue-500 font-mono text-xs mb-4">/// SPECIFICATIONS</div>
            <h2 className="text-4xl font-bold mb-6">Engineered for <br />Australian Legislation.</h2>
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="mt-1">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white text-lg">Workers Comp State Matching</h4>
                  <p className="text-slate-400 text-sm mt-1">Automatic state scheme detection and project location matching for all Australian states.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="mt-1">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white text-lg">AS 4000 Contract Matching</h4>
                  <p className="text-slate-400 text-sm mt-1">We parse your head contract requirements and match every sub's policy against them.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="mt-1">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white text-lg">Phoenix Detection</h4>
                  <p className="text-slate-400 text-sm mt-1">We flag when the "Insured Entity" doesn't match the "Contract Entity" (ABN mismatch).</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-1/2">
            <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 p-8 backdrop-blur-sm">
              <div className="absolute -top-4 -right-4 bg-blue-600 text-white px-4 py-1 rounded text-xs font-bold font-mono tracking-wider shadow-lg">
                LIVE_FEED
              </div>
              <div className="space-y-4 font-mono text-sm">
                <div className="flex items-center gap-4 text-slate-500 border-b border-white/5 pb-2">
                  <span className="w-20">09:14:22</span>
                  <span className="text-emerald-400">SCAN_COMPLETE</span>
                  <span className="text-white">Metro_Civil_Liability.pdf</span>
                </div>
                <div className="flex items-center gap-4 text-slate-500 border-b border-white/5 pb-2">
                  <span className="w-20">09:14:25</span>
                  <span class="text-emerald-400">SCAN_COMPLETE</span>
                  <span class="text-white">J_Smith_WorkCover.pdf</span>
                </div>
                <div className="flex items-center gap-4 text-slate-500 border-b border-white/5 pb-2">
                  <span className="w-20">09:15:01</span>
                  <span class="text-red-400">RISK_DETECTED</span>
                  <span class="text-white">Electrical_Systems_Pty_Ltd</span>
                </div>
                <div className="pl-24 text-xs text-red-300">
                  {'>'} Error: Policy expires in 2 days (requires 30 days)
                  <br />{'>'} Action: Broker notified automatically.
                </div>
                <div className="flex items-center gap-4 text-slate-500 pt-2">
                  <span className="w-20">09:15:10</span>
                  <span className="text-blue-400 animate-pulse">PROCESSING...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-950 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-600" />
              <span className="font-bold text-slate-600">RiskShield AI</span>
            </div>
            <div className="text-slate-600 text-sm">
              &copy; {new Date().getFullYear()} RiskShield AI. Sydney, Australia.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}