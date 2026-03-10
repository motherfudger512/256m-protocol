"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { type ChainId, type ChainAdapter } from "./types";
import { useSolanaAdapter } from "./solana/SolanaChainProvider";
import { useEthereumAdapter } from "./ethereum/EthereumChainProvider";

interface ChainContextValue {
  activeChain: ChainId;
  setActiveChain: (chain: ChainId) => void;
  adapter: ChainAdapter;
}

const ChainContext = createContext<ChainContextValue | null>(null);

export function useChain(): ChainContextValue {
  const ctx = useContext(ChainContext);
  if (!ctx) throw new Error("useChain must be used within ChainProvider");
  return ctx;
}

export function ChainProvider({ children }: { children: ReactNode }) {
  const [activeChain, setActiveChain] = useState<ChainId>("solana");

  const solanaAdapter = useSolanaAdapter();
  const ethereumAdapter = useEthereumAdapter();

  const adapter = activeChain === "solana" ? solanaAdapter : ethereumAdapter;

  const value = useMemo(
    () => ({ activeChain, setActiveChain, adapter }),
    [activeChain, adapter],
  );

  return (
    <ChainContext.Provider value={value}>{children}</ChainContext.Provider>
  );
}
