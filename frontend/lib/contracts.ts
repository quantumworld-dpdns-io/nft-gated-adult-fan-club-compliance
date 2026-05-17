import {
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
  type BaseError,
} from "wagmi";
import { type Address, zeroAddress } from "viem";

export const CONTRACT_ADDRESSES = {
  membershipNFT: (process.env.NEXT_PUBLIC_MEMBERSHIP_NFT_ADDRESS || zeroAddress) as Address,
  ageVerificationOracle: (process.env.NEXT_PUBLIC_AGE_VERIFICATION_ORACLE_ADDRESS || zeroAddress) as Address,
  tokenGatedAccess: (process.env.NEXT_PUBLIC_TOKEN_GATED_ACCESS_ADDRESS || zeroAddress) as Address,
  complianceRegistry: (process.env.NEXT_PUBLIC_COMPLIANCE_REGISTRY_ADDRESS || zeroAddress) as Address,
} as const;

export const MEMBERSHIP_NFT_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [{ name: "tier", type: "uint8", internalType: "enum MembershipNFT.Tier" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "upgradeTier",
    inputs: [
      { name: "tokenId", type: "uint256", internalType: "uint256" },
      { name: "newTier", type: "uint8", internalType: "enum MembershipNFT.Tier" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getMembership",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "tier", type: "uint8", internalType: "enum MembershipNFT.Tier" },
      { name: "mintedAt", type: "uint256", internalType: "uint256" },
      { name: "upgradedAt", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserTokens",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserActiveTokens",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "BASIC_PRICE",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "PREMIUM_PRICE",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "VIP_PRICE",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "MembershipMinted",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "tier", type: "uint8", indexed: false, internalType: "enum MembershipNFT.Tier" },
      { name: "price", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;

export const AGE_VERIFICATION_ABI = [
  {
    type: "function",
    name: "isVerified",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVerificationExpiry",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "submitVerification",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "proofHash", type: "bytes32", internalType: "bytes32" },
      { name: "expiry", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "VerificationSubmitted",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "proofHash", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "expiry", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;

export const TOKEN_GATED_ACCESS_ABI = [
  {
    type: "function",
    name: "canAccess",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "contentId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "checkAccessWithReason",
    inputs: [
      { name: "user", type: "address", internalType: "address" },
      { name: "contentId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "", type: "bool", internalType: "bool" },
      { name: "", type: "string", internalType: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAccessibleContentTiers",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
] as const;

export enum Tier {
  BASIC = 0,
  PREMIUM = 1,
  VIP = 2,
}

export const TIER_PRICES: Record<Tier, bigint> = {
  [Tier.BASIC]: BigInt("100000000000000000"),
  [Tier.PREMIUM]: BigInt("500000000000000000"),
  [Tier.VIP]: BigInt("1000000000000000000"),
};

export const TIER_LABELS: Record<Tier, string> = {
  [Tier.BASIC]: "Basic",
  [Tier.PREMIUM]: "Premium",
  [Tier.VIP]: "VIP",
};

export function useBalanceOf(address: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.membershipNFT,
    abi: MEMBERSHIP_NFT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useGetUserTokens(address: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.membershipNFT,
    abi: MEMBERSHIP_NFT_ABI,
    functionName: "getUserTokens",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useGetMembership(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.membershipNFT,
    abi: MEMBERSHIP_NFT_ABI,
    functionName: "getMembership",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useIsVerified(address: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.ageVerificationOracle,
    abi: AGE_VERIFICATION_ABI,
    functionName: "isVerified",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useCanAccess(address: Address | undefined, contentId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.tokenGatedAccess,
    abi: TOKEN_GATED_ACCESS_ABI,
    functionName: "canAccess",
    args: address && contentId !== undefined ? [address, contentId] : undefined,
    query: { enabled: !!address && contentId !== undefined },
  });
}

export function useCheckAccessWithReason(address: Address | undefined, contentId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.tokenGatedAccess,
    abi: TOKEN_GATED_ACCESS_ABI,
    functionName: "checkAccessWithReason",
    args: address && contentId !== undefined ? [address, contentId] : undefined,
    query: { enabled: !!address && contentId !== undefined },
  });
}

export function useGetAccessibleContentTiers(address: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.tokenGatedAccess,
    abi: TOKEN_GATED_ACCESS_ABI,
    functionName: "getAccessibleContentTiers",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useMintMembership() {
  return useWriteContract();
}

export function useSubmitVerification() {
  return useWriteContract();
}

export function useWatchMembershipMinted() {
  return useWatchContractEvent({
    address: CONTRACT_ADDRESSES.membershipNFT,
    abi: MEMBERSHIP_NFT_ABI,
    eventName: "MembershipMinted",
  });
}
