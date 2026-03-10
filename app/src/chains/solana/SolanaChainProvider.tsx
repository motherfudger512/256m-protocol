"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useDemoMode } from "@/hooks/useDemoMode";
import { SOLANA_CONFIG, type ChainAdapter } from "../types";
import { useSolanaPoolState } from "./useSolanaPoolState";
import { useSolanaCustomer } from "./useSolanaCustomer";
import { useSolanaProtocolState } from "./useSolanaProtocolState";
import { useSolanaClaimsState } from "./useSolanaClaimsState";
import { useSolanaLPPosition } from "./useSolanaLPPosition";
import { useSolanaPolicies } from "./useSolanaPolicies";
import { useSolanaPolicyholder } from "./useSolanaPolicyholder";
import { useSolanaLPProvider } from "./useSolanaLPProvider";

export function useSolanaAdapter(): ChainAdapter {
  const { publicKey, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const isDemo = useDemoMode();

  return {
    config: SOLANA_CONFIG,
    walletAddress: publicKey?.toBase58() ?? null,
    connected: !!publicKey,
    connecting,
    isDemo,
    connect: () => setVisible(true),
    disconnect,
    usePoolState: useSolanaPoolState,
    useCustomer: useSolanaCustomer,
    useProtocolState: useSolanaProtocolState,
    useClaimsState: useSolanaClaimsState,
    useLPPosition: useSolanaLPPosition,
    usePolicies: useSolanaPolicies,
    usePolicyholder: useSolanaPolicyholder,
    useLPProvider: useSolanaLPProvider,
  };
}
