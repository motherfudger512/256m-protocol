"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrograms } from "@/hooks/usePrograms";
import { useDemoMode } from "@/hooks/useDemoMode";
import { deriveClaimsState } from "@/lib/programs/pdas";
import { demoClaimsState } from "@/lib/demoData";
import type { IDataHook, NormalizedClaimsState } from "../types";

function num(bn: any): number {
  return typeof bn === "number" ? bn : bn.toNumber();
}

function normalize(raw: any): NormalizedClaimsState {
  return {
    totalClaims: num(raw.totalClaims),
    approvedClaims: num(raw.approvedClaims),
    rejectedClaims: num(raw.rejectedClaims),
    totalPaidOut: num(raw.totalPaidOut) / 1e6,
    maxAutoPayout: num(raw.maxAutoPayout) / 1e6,
    dailyAutoPayoutLimit: num(raw.dailyAutoPayoutLimit) / 1e6,
    paused: raw.paused,
  };
}

export function useSolanaClaimsState(): IDataHook<NormalizedClaimsState> {
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const [data, setData] = useState<NormalizedClaimsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (demo) {
      setData(normalize(demoClaimsState));
      setError(null);
      setLoading(false);
      return;
    }
    if (!programs) return;
    setLoading(true);
    try {
      const [pda] = deriveClaimsState();
      const account =
        await (programs.claimsProcessor.account as any).claimsState.fetch(pda);
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
