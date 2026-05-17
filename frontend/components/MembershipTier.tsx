"use client";

import { Check, Crown, Sparkles, Star } from "lucide-react";

interface MembershipTierProps {
  name: string;
  price: string;
  priceLabel: string;
  features: string[];
  tierId: number;
  isSelected: boolean;
  isPopular?: boolean;
  onSelect: (tierId: number) => void;
  onMint: (tierId: number) => void;
  isMinting?: boolean;
  disabled?: boolean;
}

const TIER_ICONS = [Star, Sparkles, Crown];

const TIER_THEMES = [
  {
    border: "border-blue-500/30",
    selectedBorder: "border-blue-400",
    bg: "bg-blue-500/5",
    buttonBg: "bg-blue-600 hover:bg-blue-500",
    accent: "text-blue-400",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  {
    border: "border-purple-500/30",
    selectedBorder: "border-purple-400",
    bg: "bg-purple-500/5",
    buttonBg: "bg-purple-600 hover:bg-purple-500",
    accent: "text-purple-400",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  {
    border: "border-amber-500/30",
    selectedBorder: "border-amber-400",
    bg: "bg-amber-500/5",
    buttonBg: "bg-amber-600 hover:bg-amber-500",
    accent: "text-amber-400",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
];

export function MembershipTier({
  name,
  price,
  priceLabel,
  features,
  tierId,
  isSelected,
  isPopular,
  onSelect,
  onMint,
  isMinting,
  disabled,
}: MembershipTierProps) {
  const theme = TIER_THEMES[tierId] || TIER_THEMES[0];
  const Icon = TIER_ICONS[tierId] || TIER_ICONS[0];

  return (
    <div
      className={`relative glass-card p-6 border-2 transition-all duration-300 cursor-pointer
        ${isSelected ? `${theme.selectedBorder} shadow-lg shadow-${theme.accent}/10 scale-[1.02]` : theme.border}
        ${disabled ? "opacity-60 cursor-not-allowed" : "hover:border-surface-500"}
      `}
      onClick={() => !disabled && onSelect(tierId)}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-primary-600 to-purple-600 text-white shadow-lg">
            Most Popular
          </span>
        </div>
      )}

      <div className="flex flex-col items-center text-center space-y-4">
        <div className={`w-14 h-14 rounded-2xl ${theme.bg} flex items-center justify-center`}>
          <Icon className={`w-7 h-7 ${theme.accent}`} />
        </div>

        <div>
          <h3 className="text-xl font-bold text-surface-100">{name}</h3>
          <div className="mt-2">
            <span className="text-3xl font-bold text-white">{price}</span>
            <span className="text-surface-400 text-sm ml-1">{priceLabel}</span>
          </div>
        </div>

        <ul className="w-full space-y-2.5 text-left">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3 text-sm">
              <Check className={`w-4 h-4 mt-0.5 shrink-0 ${theme.accent}`} />
              <span className="text-surface-300">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onMint(tierId);
          }}
          disabled={disabled || isMinting}
          className={`w-full py-3 px-6 rounded-xl text-sm font-semibold text-white transition-all
            ${theme.buttonBg}
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg shadow-${theme.accent}/20
          `}
        >
          {isMinting ? "Minting..." : isPopular ? "Get Started" : "Mint"}
        </button>
      </div>
    </div>
  );
}
