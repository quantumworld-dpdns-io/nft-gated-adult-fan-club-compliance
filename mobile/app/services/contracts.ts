import { ethers } from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONTRACT_ADDRESSES_KEY = '@contract_addresses';

interface ContractAddresses {
  membershipNFT: string;
  ageVerification: string;
  tokenGatedAccess: string;
  complianceRegistry: string;
}

const DEFAULT_ADDRESSES: ContractAddresses = {
  membershipNFT: '',
  ageVerification: '',
  tokenGatedAccess: '',
  complianceRegistry: '',
};

let cachedAddresses: ContractAddresses | null = null;

async function getContractAddresses(): Promise<ContractAddresses> {
  if (cachedAddresses) return cachedAddresses;
  try {
    const stored = await AsyncStorage.getItem(CONTRACT_ADDRESSES_KEY);
    if (stored) {
      cachedAddresses = JSON.parse(stored);
      return cachedAddresses!;
    }
  } catch {}
  return DEFAULT_ADDRESSES;
}

export async function setContractAddresses(addresses: ContractAddresses): Promise<void> {
  cachedAddresses = addresses;
  await AsyncStorage.setItem(CONTRACT_ADDRESSES_KEY, JSON.stringify(addresses));
}

export async function getSigner(): Promise<ethers.JsonRpcSigner | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      return signer;
    }
  } catch {}
  return null;
}

export async function getProvider(): Promise<ethers.JsonRpcProvider | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return new ethers.BrowserProvider((window as any).ethereum);
    }
  } catch {}
  return null;
}

const MEMBERSHIP_NFT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function mint(address to, uint256 tier) external',
  'function getTier(uint256 tokenId) view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const AGE_VERIFICATION_ABI = [
  'function verifyAge(address user, bytes calldata proof, uint256[2] calldata publicSignals) external',
  'function isVerified(address user) view returns (bool)',
  'function verificationExpiry(address user) view returns (uint256)',
  'event AgeVerified(address indexed user, uint256 timestamp)',
];

const TOKEN_GATED_ACCESS_ABI = [
  'function hasAccess(address user, uint256 contentId) view returns (bool)',
  'function getRequiredTier(uint256 contentId) view returns (uint8)',
  'event AccessGranted(address indexed user, uint256 indexed contentId)',
];

const COMPLIANCE_REGISTRY_ABI = [
  'function logComplianceCheck(address user, bytes32 actionHash, bool passed) external',
  'function getComplianceHistory(address user, uint256 offset, uint256 limit) view returns (bytes32[] memory, bool[] memory, uint256[] memory)',
  'event ComplianceLogged(address indexed user, bytes32 indexed actionHash, bool passed, uint256 timestamp)',
];

export async function getMembershipContract(): Promise<ethers.Contract | null> {
  const addresses = await getContractAddresses();
  const provider = await getProvider();
  if (!provider || !addresses.membershipNFT) return null;
  return new ethers.Contract(addresses.membershipNFT, MEMBERSHIP_NFT_ABI, provider);
}

export async function getAgeVerificationContract(): Promise<ethers.Contract | null> {
  const addresses = await getContractAddresses();
  const provider = await getProvider();
  if (!provider || !addresses.ageVerification) return null;
  return new ethers.Contract(addresses.ageVerification, AGE_VERIFICATION_ABI, provider);
}

export async function getTokenGatedContract(): Promise<ethers.Contract | null> {
  const addresses = await getContractAddresses();
  const provider = await getProvider();
  if (!provider || !addresses.tokenGatedAccess) return null;
  return new ethers.Contract(addresses.tokenGatedAccess, TOKEN_GATED_ACCESS_ABI, provider);
}

export async function getComplianceRegistry(): Promise<ethers.Contract | null> {
  const addresses = await getContractAddresses();
  const provider = await getProvider();
  if (!provider || !addresses.complianceRegistry) return null;
  return new ethers.Contract(addresses.complianceRegistry, COMPLIANCE_REGISTRY_ABI, provider);
}

export async function getNFTBalance(address: string): Promise<number> {
  const contract = await getMembershipContract();
  if (!contract) return 0;
  try {
    const balance = await contract.balanceOf(address);
    return Number(balance);
  } catch {
    return 0;
  }
}

export async function getTierForToken(owner: string, index: number): Promise<number> {
  const contract = await getMembershipContract();
  if (!contract) return 0;
  try {
    const tokenId = await contract.tokenOfOwnerByIndex(owner, index);
    const tier = await contract.getTier(tokenId);
    return Number(tier);
  } catch {
    return 0;
  }
}

export async function checkAgeVerification(address: string): Promise<boolean> {
  const contract = await getAgeVerificationContract();
  if (!contract) return false;
  try {
    return await contract.isVerified(address);
  } catch {
    return false;
  }
}

export async function checkContentAccess(address: string, contentId: string): Promise<boolean> {
  const contract = await getTokenGatedContract();
  if (!contract) return false;
  try {
    return await contract.hasAccess(address, contentId);
  } catch {
    return false;
  }
}

export async function submitZkProofOnChain(
  proof: string,
  publicSignals: string[]
): Promise<boolean> {
  const signer = await getSigner();
  if (!signer) return false;
  const addresses = await getContractAddresses();
  if (!addresses.ageVerification) return false;
  try {
    const contract = new ethers.Contract(
      addresses.ageVerification,
      AGE_VERIFICATION_ABI,
      signer
    );
    const tx = await contract.verifyAge(
      await signer.getAddress(),
      proof,
      publicSignals
    );
    await tx.wait();
    return true;
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const accounts = await (window as any).ethereum.request({
        method: 'eth_requestAccounts',
      });
      return accounts[0] || null;
    }
  } catch {}
  return null;
}

export async function disconnectWallet(): Promise<void> {
  return;
}

export async function signMessage(message: string): Promise<string | null> {
  const signer = await getSigner();
  if (!signer) return null;
  try {
    return await signer.signMessage(message);
  } catch {
    return null;
  }
}
