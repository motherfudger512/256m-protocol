"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrograms } from "@/hooks/usePrograms";
import { useDemoMode } from "@/hooks/useDemoMode";
import { deriveProtocolState } from "@/lib/programs/pdas";
import { demoProtocolState } from "@/lib/demoData";
import type { IDataHook, NormalizedProtocolState } from "../types";

function num(bn: any): number {
  return typeof bn === "number" ? bn : bn.toNumber();
}

function normalize(raw: any): NormalizedProtocolState {
  return {
    totalPolicies: num(raw.totalPolicies),
    activePolicies: num(raw.activePolicies),
    maxPolicies: num(raw.maxPolicies),
    platformFeeBps: raw.platformFeeBps,
    maxInsuredValue: num(raw.maxInsuredValue) / 1e6,
    totalPremiumsCollected: num(raw.totalPremiumsCollected) / 1e6,
    paused: raw.paused,
  };
}

export function useSolanaProtocolState(): IDataHook<NormalizedProtocolState> {
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const [data, setData] = useState<NormalizedProtocolState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (demo) {
      setData(normalize(demoProtocolState));
      setError(null);
      setLoading(false);
      return;
    }
    if (!programs) return;
    setLoading(true);
    try {
      const [pda] = deriveProtocolState();
      const account =
        await (programs.policyManager.account as any).protocolState.fetch(pda);
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
