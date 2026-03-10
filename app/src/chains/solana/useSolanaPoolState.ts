"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrograms } from "@/hooks/usePrograms";
import { useDemoMode } from "@/hooks/useDemoMode";
import { derivePoolState } from "@/lib/programs/pdas";
import { demoPoolState } from "@/lib/demoData";
import type { IDataHook, NormalizedPoolState } from "../types";

function num(bn: any): number {
  return typeof bn === "number" ? bn : bn.toNumber();
}

function normalize(raw: any): NormalizedPoolState {
  return {
    totalCapitalUsdc: num(raw.totalCapitalUsdc) / 1e6,
    totalCapitalSol: num(raw.totalCapitalSol) / 1e9,
    totalLpSupply: num(raw.totalLpSupply),
    lpFeeBps: raw.lpFeeBps,
    totalPremiumsCollected: num(raw.totalPremiumsCollected) / 1e6,
    totalClaimsPaid: num(raw.totalClaimsPaid) / 1e6,
    totalInterestEarned: num(raw.totalInterestEarned) / 1e6,
    totalDeployedUsdc: num(raw.totalDeployedUsdc) / 1e6,
    scrCoverageRatio: raw.scrCoverageRatio,
    paused: raw.paused,
    supportsNativeDeposit: true,
  };
}

export function useSolanaPoolState(): IDataHook<NormalizedPoolState> {
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const [data, setData] = useState<NormalizedPoolState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (demo) {
      setData(normalize(demoPoolState));
      setError(null);
      setLoading(false);
      return;
    }
    if (!programs) return;
    setLoading(true);
    try {
      const [pda] = derivePoolState();
      const account =
        await (programs.liquidityPool.account as any).poolState.fetch(pda);
      setData(normalize(account));
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [programs, demo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
