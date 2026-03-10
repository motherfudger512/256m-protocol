"use client";

import { useState, useEffect, useCallback } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { usePrograms } from "@/hooks/usePrograms";
import { useDemoMode } from "@/hooks/useDemoMode";
import { deriveLpPosition } from "@/lib/programs/pdas";
import { getDemoLpPosition } from "@/lib/demoData";
import type { IExistsHook, NormalizedLPPosition } from "../types";

function num(bn: any): number {
  return typeof bn === "number" ? bn : bn.toNumber();
}

function normalize(raw: any): NormalizedLPPosition {
  return {
    owner: raw.owner.toBase58(),
    lpTokens: num(raw.lpTokens),
    usdcDeposited: num(raw.usdcDeposited) / 1e6,
    solDeposited: num(raw.solDeposited) / 1e9,
    rewardsEarned: num(raw.rewardsEarned) / 1e6,
    depositedAt: num(raw.depositedAt),
  };
}

export function useSolanaLPPosition(): IExistsHook<NormalizedLPPosition> {
  const wallet = useAnchorWallet();
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const [data, setData] = useState<NormalizedLPPosition | null>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (demo && wallet) {
      setData(normalize(getDemoLpPosition(wallet.publicKey)));
      setExists(true);
      setLoading(false);
      return;
    }
    if (!programs || !wallet) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [pda] = deriveLpPosition(wallet.publicKey);
      const account =
        await (programs.liquidityPool.account as any).lpPosition.fetch(pda);
      setData(normalize(account));
      setExists(true);
    } catch {
      setData(null);
      setExists(false);
    } finally {
      setLoading(false);
    }
  }, [programs, wallet, demo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, exists, loading, refresh };
}
