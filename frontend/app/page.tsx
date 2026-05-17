"use client";

import Link from "next/link";
import { Shield, Fingerprint, Lock, TrendingUp, ArrowRight, CheckCircle, Sparkles } from "lucide-react";

const FEATURES = [
  {
    icon: Fingerprint,
    title: "ZK Age Verification",
    description:
      "Prove you're over the age threshold without revealing your birth date. Zero-knowledge proofs ensure your privacy is protected at all times.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Shield,
    title: "NFT-Gated Access",
    description:
      "Membership NFTs control access to exclusive content. Different tiers unlock different levels of access across the platform.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: Lock,
    title: "Compliance-First",
    description:
      "Built with regulatory compliance at every layer. Audit logs, KYC/AML integration, and data protection by design.",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: TrendingUp,
    title: "On-Chain Governance",
    description:
      "Transparent membership management on-chain. Soulbound tokens prevent transfer, ensuring verified members control access.",
    gradient: "from-green-500 to-emerald-500",
  },
];

const STEPS = [
  { number: "01", title: "Connect Wallet", description: "Link your wallet to get started" },
  { number: "02", title: "Verify Age", description: "Zero-knowledge age proof, no data shared" },
  { number: "03", title: "Mint Membership", description: "Choose your tier and mint your NFT" },
  { number: "04", title: "Access Content", description: "Unlock exclusive gated content" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center max-w-3xl mx-auto animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-sm text-primary-400 mb-8">
              <Sparkles className="w-4 h-4" />
              <span>Privacy-Preserving Access Control</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="gradient-text">NFT-Gated</span>
              <br />
              <span className="text-surface-100">Adult Fan Club</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-surface-400 max-w-2xl mx-auto leading-relaxed">
              A compliance-first platform that combines zero-knowledge age verification with NFT-gated access.
              Prove your age, mint your membership, and unlock exclusive content — all while preserving your privacy.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/membership" className="btn-primary text-base px-8 py-3.5">
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link href="/verify" className="btn-secondary text-base px-8 py-3.5">
                Verify Age
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-surface-500">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                ZK Privacy
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                On-Chain NFTs
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                GDPR Compliant
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                Audited
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-surface-100">
            Built for Privacy & Compliance
          </h2>
          <p className="mt-4 text-surface-400 max-w-xl mx-auto">
            Every feature is designed from the ground up to protect user privacy while meeting regulatory requirements.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="glass-card p-6 group hover:border-primary-500/30 transition-all duration-300"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} p-0.5 mb-4`}
                >
                  <div className="w-full h-full rounded-xl bg-surface-900 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-surface-200 mb-2">{feature.title}</h3>
                <p className="text-sm text-surface-400 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="glass-card p-8 sm:p-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-surface-100">How It Works</h2>
            <p className="mt-4 text-surface-400 max-w-lg mx-auto">
              Four simple steps to access exclusive gated content
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((step) => (
              <div key={step.number} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold gradient-text">{step.number}</span>
                </div>
                <h3 className="text-lg font-semibold text-surface-200 mb-2">{step.title}</h3>
                <p className="text-sm text-surface-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-surface-100 mb-4">
            Ready to Join?
          </h2>
          <p className="text-surface-400 mb-8 max-w-lg mx-auto">
            Connect your wallet, verify your age with a zero-knowledge proof, and mint your membership NFT.
          </p>
          <Link href="/membership" className="btn-primary text-base px-10 py-3.5">
            View Membership Tiers
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
