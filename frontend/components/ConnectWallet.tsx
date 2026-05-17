"use client";

import { useWeb3Modal, useWeb3ModalAccount, useWeb3ModalProvider } from "@web3modal/wagmi/react";
import { useDisconnect } from "wagmi";

export function ConnectWallet() {
  const { open } = useWeb3Modal();
  const { address, isConnected, chainId } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const { disconnect } = useDisconnect();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getNetworkName = (id: number) => {
    switch (id) {
      case 1: return "Ethereum";
      case 11155111: return "Sepolia";
      case 137: return "Polygon";
      case 80001: return "Mumbai";
      case 31337: return "Hardhat";
      default: return `Chain ${id}`;
    }
  };

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 text-xs text-surface-400">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          {chainId && getNetworkName(chainId)}
        </div>
        <div className="relative group">
          <button
            onClick={() => open({ view: "Account" })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm font-medium text-surface-200 hover:bg-surface-700 hover:border-primary-500/50 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-green-400" />
            {truncateAddress(address)}
          </button>
          <div className="absolute right-0 top-full mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div className="glass-card p-2 space-y-1">
              <button
                onClick={() => open({ view: "Account" })}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
              >
                Account Details
              </button>
              <button
                onClick={() => open({ view: "Networks" })}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
              >
                Switch Network
              </button>
              <hr className="border-surface-700 my-1" />
              <button
                onClick={() => disconnect()}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => open()}
      className="btn-primary"
    >
      Connect Wallet
    </button>
  );
}
