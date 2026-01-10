import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | RiskSure AI - Plans from $349/month',
  description: 'Transparent pricing for automated COC verification. Free for subcontractors. Plans for builders managing 25 to unlimited vendors. Start your 14-day free trial.',
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children;
}
