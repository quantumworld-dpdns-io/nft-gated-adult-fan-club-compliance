"use client";

import { useState } from "react";
import { ExternalLink, Shield, Clock, Wallet } from "lucide-react";

interface NFTCardProps {
  tokenId: number;
  tier: string;
  imageUrl?: string;
  ownerAddress: string;
  mintedAt: string;
  onViewDetails?: (tokenId: number) => void;
  onTransfer?: (tokenId: number) => void;
}

const TIER_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  basic: {
    label: "Basic",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  premium: {
    label: "Premium",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  vip: {
    label: "VIP",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
};

export function NFTCard({
  tokenId,
  tier,
  imageUrl,
  ownerAddress,
  mintedAt,
  onViewDetails,
  onTransfer,
}: NFTCardProps) {
  const [imageError, setImageError] = useState(false);
  const tierConfig = TIER_CONFIG[tier.toLowerCase()] || TIER_CONFIG.basic;

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="glass-card overflow-hidden group hover:border-primary-500/30 transition-all duration-300">
      <div className="relative aspect-square bg-surface-900 overflow-hidden">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={`Token #${tokenId}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Shield className="w-16 h-16 text-surface-700" />
          </div>
        )}
        <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold ${tierConfig.bgColor} ${tierConfig.color} border border-current/20`}>
          {tierConfig.label}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-surface-200">#{tokenId}</h3>
          <span className={`text-xs ${tierConfig.color} ${tierConfig.bgColor} px-2 py-0.5 rounded-md font-medium`}>
            {tierConfig.label} Tier
          </span>
        </div>

        <div className="space-y-2 text-xs text-surface-400">
          <div className="flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{truncateAddress(ownerAddress)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Minted {formatDate(mintedAt)}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(tokenId)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-xs font-medium text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Details
            </button>
          )}
          {onTransfer && (
            <button
              onClick={() => onTransfer(tokenId)}
              className="flex-1 px-3 py-2 rounded-lg bg-primary-600/10 border border-primary-500/20 text-xs font-medium text-primary-400 hover:bg-primary-600/20 transition-colors"
            >
              Transfer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
