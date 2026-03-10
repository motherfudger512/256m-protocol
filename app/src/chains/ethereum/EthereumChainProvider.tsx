"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ETHEREUM_CONFIG, type ChainAdapter } from "../types";
import { useEthDemoMode } from "./useEthDemoMode";
import { useEthPoolState } from "./useEthPoolState";
import { useEthCustomer } from "./useEthCustomer";
import { useEthProtocolState } from "./useEthProtocolState";
import { useEthClaimsState } from "./useEthClaimsState";
import { useEthLPPosition } from "./useEthLPPosition";
import { useEthPolicies } from "./useEthPolicies";
import { useEthPolicyholder } from "./useEthPolicyholder";
import { useEthLPProvider } from "./useEthLPProvider";

export function useEthereumAdapter(): ChainAdapter {
  const { address, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const isDemo = useEthDemoMode();

  return {
    config: ETHEREUM_CONFIG,
    walletAddress: address ?? null,
    connected: !!address,
    connecting: isConnecting,
    isDemo,
    connect: () => openConnectModal?.(),
    disconnect: () => disconnect(),
    usePoolState: useEthPoolState,
    useCustomer: useEthCustomer,
    useProtocolState: useEthProtocolState,
    useClaimsState: useEthClaimsState,
    useLPPosition: useEthLPPosition,
    usePolicies: useEthPolicies,
    usePolicyholder: useEthPolicyholder,
    useLPProvider: useEthLPProvider,
  };
}
