"use client";

import { WagmiProvider, cookieToInitialState, type Config } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { defaultWagmiConfig } from "@web3modal/wagmi/react/config";
import { mainnet, sepolia, hardhat, polygon, polygonMumbai } from "wagmi/chains";
import { ReactNode, useState } from "react";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const metadata = {
  name: "FanClub",
  description: "NFT-Gated Adult Fan Club Compliance Platform",
  url: "https://fanclub.vercel.app",
  icons: ["/vercel.svg"],
};

const chains = [mainnet, sepolia, hardhat, polygon, polygonMumbai] as const;

const wagmiConfig: Config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  ssr: true,
});

if (projectId) {
  createWeb3Modal({
    wagmiConfig,
    projectId,
    enableAnalytics: true,
    themeMode: "dark",
    themeVariables: {
      "--w3m-color-mix": "#6366f1",
      "--w3m-color-mix-strength": 40,
      "--w3m-border-radius-master": "0.5",
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 2,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
