import { Shield } from "lucide-react";
import Link from "next/link";

const FOOTER_LINKS = {
  Platform: [
    { href: "/membership", label: "Membership" },
    { href: "/content", label: "Content" },
    { href: "/verify", label: "Age Verification" },
  ],
  Resources: [
    { href: "/docs", label: "Documentation" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
  ],
  Compliance: [
    { href: "/compliance/kyc", label: "KYC Information" },
    { href: "/compliance/aml", label: "AML Policy" },
    { href: "/compliance/gdpr", label: "GDPR Compliance" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-surface-800 bg-surface-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-surface-100">FanClub</span>
            </Link>
            <p className="text-sm text-surface-500 leading-relaxed max-w-xs">
              A compliance-first platform for NFT-gated adult fan clubs with zero-knowledge age verification.
            </p>
          </div>
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-surface-300 mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-surface-500 hover:text-surface-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-8 border-t border-surface-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-surface-600">
            &copy; {new Date().getFullYear()} FanClub. All rights reserved.
          </p>
          <p className="text-xs text-surface-600">
            Built with zero-knowledge proofs for privacy-first compliance.
          </p>
        </div>
      </div>
    </footer>
  );
}
