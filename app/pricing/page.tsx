'use client';

import { useState } from 'react';
import { Check, X, Zap, Shield, Building2, Factory, ArrowRight, Calculator } from 'lucide-react';
import Link from 'next/link';

type BillingCycle = 'monthly' | 'annual';

interface PricingTier {
  name: string;
  tagline: string;
  icon: React.ReactNode;
  monthlyPrice: number | null;
  annualPrice: number | null;
  vendorFee: number | string;
  features: {
    projects: string;
    users: string;
    verification: string;
    automation: string;
    integrations: string;
    support: string;
  };
  highlights: string[];
  cta: string;
  ctaLink: string;
  popular?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: 'Essential',
    tagline: 'For growing builders',
    icon: <Zap className="h-6 w-6" />,
    monthlyPrice: 349,
    annualPrice: 290, // ~17% discount
    vendorFee: 29,
    features: {
      projects: 'Up to 5 projects',
      users: '3 team members',
      verification: 'Standard verification (dates, limits, ABN)',
      automation: 'Draft emails for review',
      integrations: 'Xero & MYOB',
      support: 'Email support',
    },
    highlights: [
      'AI-powered COC verification',
      'Expiration tracking & alerts',
      'Compliance dashboard',
      'Document storage',
      'Basic reporting',
    ],
    cta: 'Start Free Trial',
    ctaLink: '/signup?plan=essential',
  },
  {
    name: 'Professional',
    tagline: 'For mid-sized contractors',
    icon: <Shield className="h-6 w-6" />,
    monthlyPrice: 999,
    annualPrice: 832,
    vendorFee: 25,
    features: {
      projects: 'Unlimited projects',
      users: 'Unlimited team members',
      verification: 'Deep parsing (exclusions, Principal Indemnity)',
      automation: 'Autonomous broker chasing',
      integrations: 'Procore & Autodesk',
      support: 'Priority chat & email',
    },
    highlights: [
      'Everything in Essential, plus:',
      'Principal Indemnity detection',
      'Cross-Liability verification',
      'Automated deficiency emails',
      'Subcontractor portal',
      'Broker portal',
      'Advanced analytics',
    ],
    cta: 'Start Free Trial',
    ctaLink: '/signup?plan=professional',
    popular: true,
  },
  {
    name: 'Business',
    tagline: 'For large contractors',
    icon: <Building2 className="h-6 w-6" />,
    monthlyPrice: 1999,
    annualPrice: 1666,
    vendorFee: 19,
    features: {
      projects: 'Unlimited projects',
      users: 'Unlimited team members',
      verification: 'Deep parsing + custom rules',
      automation: 'Full autonomous workflow',
      integrations: 'State Regulator APIs (icare, WorkSafe, WorkCover)',
      support: 'Dedicated Customer Success Manager',
    },
    highlights: [
      'Everything in Professional, plus:',
      'Workers Comp API verification',
      'Custom compliance rules',
      'Multi-state verification',
      'Exception workflow',
      'Audit trail & compliance reports',
      'API access',
    ],
    cta: 'Start Free Trial',
    ctaLink: '/signup?plan=business',
  },
  {
    name: 'Enterprise',
    tagline: 'For Tier 1 & infrastructure',
    icon: <Factory className="h-6 w-6" />,
    monthlyPrice: null,
    annualPrice: null,
    vendorFee: 'Volume pricing',
    features: {
      projects: 'Unlimited projects',
      users: 'Unlimited team members',
      verification: 'Custom AI models',
      automation: 'Full workflow + custom integrations',
      integrations: 'Custom ERP, SSO, Aconex',
      support: '24/7 SLA with dedicated team',
    },
    highlights: [
      'Everything in Business, plus:',
      'Custom AI training for your formats',
      'Oracle Aconex integration',
      'SAP / Oracle ERP integration',
      'SSO (SAML/OIDC)',
      'On-premise deployment option',
      'Custom SLA',
      'Dedicated support team',
    ],
    cta: 'Contact Sales',
    ctaLink: '/contact?plan=enterprise',
  },
];

const comparisonFeatures = [
  { category: 'Platform', features: [
    { name: 'AI-powered COC verification', essential: true, professional: true, business: true, enterprise: true },
    { name: 'Projects', essential: 'Up to 5', professional: 'Unlimited', business: 'Unlimited', enterprise: 'Unlimited' },
    { name: 'Team members', essential: '3', professional: 'Unlimited', business: 'Unlimited', enterprise: 'Unlimited' },
    { name: 'Document storage', essential: true, professional: true, business: true, enterprise: true },
  ]},
  { category: 'Verification Depth', features: [
    { name: 'Dates & limits check', essential: true, professional: true, business: true, enterprise: true },
    { name: 'ABN verification', essential: true, professional: true, business: true, enterprise: true },
    { name: 'APRA insurer validation', essential: true, professional: true, business: true, enterprise: true },
    { name: 'Principal Indemnity detection', essential: false, professional: true, business: true, enterprise: true },
    { name: 'Cross-Liability verification', essential: false, professional: true, business: true, enterprise: true },
    { name: 'Exclusion parsing (Hot Work, etc.)', essential: false, professional: true, business: true, enterprise: true },
    { name: 'Workers Comp state verification', essential: false, professional: false, business: true, enterprise: true },
    { name: 'Custom compliance rules', essential: false, professional: false, business: true, enterprise: true },
    { name: 'Custom AI model training', essential: false, professional: false, business: false, enterprise: true },
  ]},
  { category: 'Automation', features: [
    { name: 'Expiration alerts', essential: true, professional: true, business: true, enterprise: true },
    { name: 'Draft deficiency emails', essential: true, professional: true, business: true, enterprise: true },
    { name: 'Autonomous broker chasing', essential: false, professional: true, business: true, enterprise: true },
    { name: 'Auto follow-up sequences', essential: false, professional: true, business: true, enterprise: true },
    { name: 'Full workflow automation', essential: false, professional: false, business: true, enterprise: true },
  ]},
  { category: 'Portals', features: [
    { name: 'Subcontractor self-service portal', essential: false, professional: true, business: true, enterprise: true },
    { name: 'Broker portal', essential: false, professional: true, business: true, enterprise: true },
  ]},
  { category: 'Integrations', features: [
    { name: 'Xero', essential: true, professional: true, business: true, enterprise: true },
    { name: 'MYOB', essential: true, professional: true, business: true, enterprise: true },
    { name: 'Procore', essential: false, professional: true, business: true, enterprise: true },
    { name: 'Autodesk Construction Cloud', essential: false, professional: true, business: true, enterprise: true },
    { name: 'icare NSW API', essential: false, professional: false, business: true, enterprise: true },
    { name: 'WorkSafe Victoria API', essential: false, professional: false, business: true, enterprise: true },
    { name: 'WorkCover Queensland API', essential: false, professional: false, business: true, enterprise: true },
    { name: 'Oracle Aconex', essential: false, professional: false, business: false, enterprise: true },
    { name: 'Custom ERP integration', essential: false, professional: false, business: false, enterprise: true },
    { name: 'SSO (SAML/OIDC)', essential: false, professional: false, business: false, enterprise: true },
    { name: 'API access', essential: false, professional: false, business: true, enterprise: true },
  ]},
  { category: 'Support', features: [
    { name: 'Email support', essential: true, professional: true, business: true, enterprise: true },
    { name: 'Priority chat support', essential: false, professional: true, business: true, enterprise: true },
    { name: 'Dedicated CSM', essential: false, professional: false, business: true, enterprise: true },
    { name: '24/7 SLA', essential: false, professional: false, business: false, enterprise: true },
    { name: 'Custom onboarding', essential: false, professional: false, business: true, enterprise: true },
  ]},
];

const faqs = [
  {
    question: 'What is an "Active Vendor"?',
    answer: 'A vendor is considered "Active" if they have a document uploaded, verified, or monitored within the billing year. You don\'t pay for dormant vendors — only those with current compliance activity.',
  },
  {
    question: 'Is RiskSure AI really free for subcontractors?',
    answer: 'Yes. Subcontractors access the portal at no cost. They can upload certificates, view their compliance status, and respond to deficiency notices without paying anything. The head contractor covers the platform cost.',
  },
  {
    question: 'How does the 14-day free trial work?',
    answer: 'You get full access to your chosen plan for 14 days. No credit card required to start. Upload your subcontractor list, verify certificates, and see the ROI before you commit.',
  },
  {
    question: 'Can I switch plans later?',
    answer: 'Yes. Upgrade anytime and we\'ll prorate your billing. Downgrades take effect at your next billing cycle.',
  },
  {
    question: 'What happens when a certificate expires?',
    answer: 'RiskSure AI sends automated reminders 30, 14, and 7 days before expiry. On Professional and above, it also sends deficiency emails directly to brokers and follows up automatically.',
  },
  {
    question: 'How accurate is the AI verification?',
    answer: 'Our AI achieves >98% accuracy on Australian insurer formats. Documents with low confidence scores are flagged for human review. You can always override any AI decision.',
  },
  {
    question: 'What\'s the difference between Principal Indemnity detection and basic verification?',
    answer: 'Basic verification checks dates, limits, and ABN matching. Principal Indemnity detection reads the actual policy wording to confirm the clause exists and names your company correctly — not just that a checkbox was ticked.',
  },
  {
    question: 'Do you offer annual billing?',
    answer: 'Yes. Pay annually and save 17% (equivalent to 2 months free). Contact us for annual invoicing with Australian payment terms.',
  },
];

function formatPrice(price: number | null): string {
  if (price === null) return 'Custom';
  return `$${price.toLocaleString()}`;
}

function FeatureCheck({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-gray-900">{value}</span>;
  }
  return value ? (
    <Check className="h-5 w-5 text-green-600" />
  ) : (
    <X className="h-5 w-5 text-gray-300" />
  );
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-4xl py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Pay for what you need. Scale as you grow. Free for subcontractors.
            </p>

            {/* Free for Subs Banner */}
            <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
              <Check className="h-4 w-4" />
              Subcontractors access the portal free — always
            </div>

            {/* Billing Toggle */}
            <div className="mt-10 flex items-center justify-center gap-4">
              <span className={`text-sm ${billingCycle === 'monthly' ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                  billingCycle === 'annual' ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    billingCycle === 'annual' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-sm ${billingCycle === 'annual' ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                Annual
              </span>
              {billingCycle === 'annual' && (
                <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Save 17%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-3xl p-8 ring-1 ${
                tier.popular
                  ? 'bg-gray-900 ring-gray-900'
                  : 'bg-white ring-gray-200'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-0 right-0 mx-auto w-fit rounded-full bg-blue-600 px-4 py-1 text-sm font-semibold text-white">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <div className={`inline-flex rounded-lg p-2 ${tier.popular ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <span className={tier.popular ? 'text-white' : 'text-gray-600'}>{tier.icon}</span>
                </div>
                <h3 className={`mt-4 text-xl font-semibold ${tier.popular ? 'text-white' : 'text-gray-900'}`}>
                  {tier.name}
                </h3>
                <p className={`mt-1 text-sm ${tier.popular ? 'text-gray-400' : 'text-gray-500'}`}>
                  {tier.tagline}
                </p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className={`text-4xl font-bold tracking-tight ${tier.popular ? 'text-white' : 'text-gray-900'}`}>
                    {formatPrice(billingCycle === 'monthly' ? tier.monthlyPrice : tier.annualPrice)}
                  </span>
                  {tier.monthlyPrice !== null && (
                    <span className={`ml-1 text-sm ${tier.popular ? 'text-gray-400' : 'text-gray-500'}`}>
                      /month
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-sm ${tier.popular ? 'text-gray-400' : 'text-gray-500'}`}>
                  + ${tier.vendorFee}{typeof tier.vendorFee === 'number' ? '/vendor/year' : ''}
                </p>
              </div>

              <ul className="mb-8 space-y-3 flex-1">
                {tier.highlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    {!highlight.includes('Everything in') && (
                      <Check className={`h-5 w-5 flex-shrink-0 ${tier.popular ? 'text-blue-400' : 'text-green-600'}`} />
                    )}
                    <span className={`text-sm ${
                      highlight.includes('Everything in')
                        ? `font-medium ${tier.popular ? 'text-gray-300' : 'text-gray-700'}`
                        : tier.popular ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {highlight}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.ctaLink}
                className={`block w-full rounded-lg py-3 px-4 text-center text-sm font-semibold transition ${
                  tier.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* 14-day trial note */}
        <p className="mt-8 text-center text-sm text-gray-500">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </div>

      {/* ROI Calculator Teaser */}
      <div className="bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="rounded-lg bg-blue-100 p-3">
                <Calculator className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">See Your ROI</h2>
                <p className="text-sm text-gray-500">Most customers see payback in 2-4 months</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 rounded-lg bg-gray-50">
                <div className="text-3xl font-bold text-gray-900">60-80%</div>
                <div className="text-sm text-gray-500 mt-1">Admin time reduced</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-gray-50">
                <div className="text-3xl font-bold text-gray-900">$225</div>
                <div className="text-sm text-gray-500 mt-1">Saved per vendor/year</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-gray-50">
                <div className="text-3xl font-bold text-gray-900">2.8x+</div>
                <div className="text-sm text-gray-500 mt-1">Average ROI</div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              A mid-sized contractor with 250 subcontractors typically spends $51,000/year on compliance admin.
              With RiskSure AI Professional, that drops to ~$18,000/year — saving $33,000+ annually.
            </p>

            <Link
              href="/contact?subject=roi-consultation"
              className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-500"
            >
              Get a personalized ROI analysis <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="py-24 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Compare Plans</h2>
            <p className="mt-4 text-lg text-gray-600">Find the right fit for your business</p>
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="mt-6 inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-500"
            >
              {showComparison ? 'Hide comparison' : 'Show full comparison'}
              <ArrowRight className={`ml-1 h-4 w-4 transition-transform ${showComparison ? 'rotate-90' : ''}`} />
            </button>
          </div>

          {showComparison && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-4 pr-4 text-sm font-semibold text-gray-900">Features</th>
                    <th className="px-4 py-4 text-sm font-semibold text-gray-900 text-center">Essential</th>
                    <th className="px-4 py-4 text-sm font-semibold text-gray-900 text-center bg-blue-50">Professional</th>
                    <th className="px-4 py-4 text-sm font-semibold text-gray-900 text-center">Business</th>
                    <th className="px-4 py-4 text-sm font-semibold text-gray-900 text-center">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((category) => (
                    <>
                      <tr key={category.category} className="border-b border-gray-100 bg-gray-50">
                        <td colSpan={5} className="py-3 px-2 text-sm font-semibold text-gray-700">
                          {category.category}
                        </td>
                      </tr>
                      {category.features.map((feature) => (
                        <tr key={feature.name} className="border-b border-gray-100">
                          <td className="py-3 pr-4 text-sm text-gray-600">{feature.name}</td>
                          <td className="px-4 py-3 text-center">
                            <FeatureCheck value={feature.essential} />
                          </td>
                          <td className="px-4 py-3 text-center bg-blue-50/50">
                            <FeatureCheck value={feature.professional} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <FeatureCheck value={feature.business} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <FeatureCheck value={feature.enterprise} />
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-gray-50 py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          <dl className="space-y-6">
            {faqs.map((faq, idx) => (
              <div key={idx} className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
                <dt className="text-lg font-semibold text-gray-900">{faq.question}</dt>
                <dd className="mt-2 text-gray-600">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-900 py-16">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Ready to eliminate compliance admin?
          </h2>
          <p className="mt-4 text-lg text-gray-300">
            Start your 14-day free trial. No credit card required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-500 transition"
            >
              Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="/contact?subject=demo"
              className="inline-flex items-center justify-center rounded-lg bg-white/10 px-6 py-3 text-base font-semibold text-white hover:bg-white/20 transition"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </div>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'RiskSure AI',
            description: 'AI-powered Certificate of Currency verification platform for Australian construction',
            brand: {
              '@type': 'Brand',
              name: 'RiskSure AI',
            },
            offers: [
              {
                '@type': 'Offer',
                name: 'Essential',
                price: '349',
                priceCurrency: 'AUD',
                priceSpecification: {
                  '@type': 'UnitPriceSpecification',
                  price: '349',
                  priceCurrency: 'AUD',
                  billingDuration: 'P1M',
                },
                availability: 'https://schema.org/InStock',
              },
              {
                '@type': 'Offer',
                name: 'Professional',
                price: '999',
                priceCurrency: 'AUD',
                priceSpecification: {
                  '@type': 'UnitPriceSpecification',
                  price: '999',
                  priceCurrency: 'AUD',
                  billingDuration: 'P1M',
                },
                availability: 'https://schema.org/InStock',
              },
              {
                '@type': 'Offer',
                name: 'Business',
                price: '1999',
                priceCurrency: 'AUD',
                priceSpecification: {
                  '@type': 'UnitPriceSpecification',
                  price: '1999',
                  priceCurrency: 'AUD',
                  billingDuration: 'P1M',
                },
                availability: 'https://schema.org/InStock',
              },
            ],
          }),
        }}
      />
    </div>
  );
}
