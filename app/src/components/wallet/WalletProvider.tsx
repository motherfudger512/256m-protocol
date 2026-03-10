"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { DemoWalletAdapter } from "./DemoWalletAdapter";
import { wagmiConfig } from "@/chains/ethereum/config";
import { ChainProvider } from "@/chains/ChainContext";

import "@solana/wallet-adapter-react-ui/styles.css";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

interface Props {
  children: ReactNode;
}

export const WalletProvider: FC<Props> = ({ children }) => {
  const endpoint =
    process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899";

  const wallets = useMemo(
    () => [
      new DemoWalletAdapter(),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    [],
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <ConnectionProvider endpoint={endpoint}>
            <SolanaWalletProvider wallets={wallets} autoConnect>
              <WalletModalProvider>
                <ChainProvider>{children}</ChainProvider>
              </WalletModalProvider>
            </SolanaWalletProvider>
          </ConnectionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
