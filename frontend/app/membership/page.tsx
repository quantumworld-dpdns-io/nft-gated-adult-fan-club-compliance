"use client";

import { useState } from "react";
import { useWeb3ModalAccount } from "@web3modal/wagmi/react";
import { useBalanceOf, useMintMembership, TIER_PRICES, Tier } from "@/lib/contracts";
import { MembershipTier } from "@/components/MembershipTier";
import { Shield, RefreshCw } from "lucide-react";

const TIERS = [
  {
    id: 0,
    name: "Basic",
    price: "0.1",
    priceLabel: "ETH",
    features: [
      "Access to basic content tier",
      "Standard definition streams",
      "Community chat access",
      "Monthly newsletter",
    ],
    isPopular: false,
  },
  {
    id: 1,
    name: "Premium",
    price: "0.5",
    priceLabel: "ETH",
    features: [
      "Access to premium content tier",
      "HD video streams",
      "Priority community support",
      "Exclusive creator AMAs",
      "Early access to new content",
    ],
    isPopular: true,
  },
  {
    id: 2,
    name: "VIP",
    price: "1.0",
    priceLabel: "ETH",
    features: [
      "Full access to all content tiers",
      "4K ultra HD streams",
      "Direct creator messaging",
      "VIP-only community channels",
      "Custom content requests",
      "Governance voting rights",
    ],
    isPopular: false,
  },
];

export default function MembershipPage() {
  const { address, isConnected } = useWeb3ModalAccount();
  const { data: balance } = useBalanceOf(address);
  const { writeContractAsync } = useMintMembership();
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [mintingTier, setMintingTier] = useState<number | null>(null);

  const handleMint = async (tierId: number) => {
    if (!isConnected) return;
    setMintingTier(tierId);
    try {
      const tierEnum = tierId as Tier;
      const price = TIER_PRICES[tierEnum];
      await writeContractAsync({
        address: process.env.NEXT_PUBLIC_MEMBERSHIP_NFT_ADDRESS as `0x${string}`,
        abi: [
          {
            type: "function",
            name: "mint",
            inputs: [{ name: "tier", type: "uint8" }],
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "payable",
          },
        ],
        functionName: "mint",
        args: [tierEnum],
        value: price,
      });
    } catch (error) {
      console.error("Mint failed:", error);
    } finally {
      setMintingTier(null);
    }
  };

  return (
    <div className="min-h-screen">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-surface-100">
            Membership Tiers
          </h1>
          <p className="mt-4 text-lg text-surface-400">
            Choose the membership tier that fits your needs. Each tier unlocks progressively
            more exclusive content and features.
          </p>
        </div>

        {isConnected && balance !== undefined && Number(balance) > 0 && (
          <div className="mt-8 p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary-400" />
              <div>
                <p className="text-sm font-medium text-primary-300">Active Membership</p>
                <p className="text-xs text-primary-400/70">
                  You own {balance.toString()} membership token{Number(balance) !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <RefreshCw className="w-4 h-4 text-primary-400/50" />
          </div>
        )}

        {!isConnected && (
          <div className="mt-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center max-w-lg mx-auto">
            <p className="text-amber-300 text-sm">
              Connect your wallet to mint a membership NFT
            </p>
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {TIERS.map((tier) => (
            <MembershipTier
              key={tier.id}
              name={tier.name}
              price={tier.price}
              priceLabel={tier.priceLabel}
              features={tier.features}
              tierId={tier.id}
              isSelected={selectedTier === tier.id}
              isPopular={tier.isPopular}
              onSelect={setSelectedTier}
              onMint={handleMint}
              isMinting={mintingTier === tier.id}
              disabled={!isConnected}
            />
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="glass-card p-8">
          <h2 className="text-2xl font-bold text-surface-100 mb-6">Subscription Options</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-surface-800 border border-surface-700 hover:border-primary-500/30 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-surface-200">Monthly</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">
                  Flexible
                </span>
              </div>
              <p className="text-2xl font-bold text-white">
                {selectedTier === 0 ? "0.1" : selectedTier === 1 ? "0.5" : "1.0"} ETH
                <span className="text-sm font-normal text-surface-400"> /mo</span>
              </p>
              <p className="text-xs text-surface-500 mt-2">Cancel anytime. No lock-in contracts.</p>
            </div>
            <div className="p-5 rounded-xl bg-gradient-to-br from-primary-500/5 to-purple-500/5 border border-primary-500/30 hover:border-primary-400 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-surface-200">Yearly</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  Save 20%
                </span>
              </div>
              <p className="text-2xl font-bold text-white">
                {selectedTier === 0 ? "0.96" : selectedTier === 1 ? "4.8" : "9.6"} ETH
                <span className="text-sm font-normal text-surface-400"> /yr</span>
              </p>
              <p className="text-xs text-surface-500 mt-2">Best value. Two months free.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
