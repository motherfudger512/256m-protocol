"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrograms } from "./usePrograms";
import { useDemoMode } from "./useDemoMode";
import { derivePoolState } from "@/lib/programs/pdas";
import { demoPoolState } from "@/lib/demoData";

export function usePoolState() {
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (demo) {
      setData(demoPoolState);
      setError(null);
      setLoading(false);
      return;
    }
    if (!programs) return;
    setLoading(true);
    try {
      const [pda] = derivePoolState();
      const account =
        await programs.liquidityPool.account.poolState.fetch(pda);
      setData(account);
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
