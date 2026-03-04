"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrograms } from "./usePrograms";
import { useDemoMode } from "./useDemoMode";
import { deriveProtocolState } from "@/lib/programs/pdas";
import { demoProtocolState } from "@/lib/demoData";

export function useProtocolState() {
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (demo) {
      setData(demoProtocolState);
      setError(null);
      setLoading(false);
      return;
    }
    if (!programs) return;
    setLoading(true);
    try {
      const [pda] = deriveProtocolState();
      const account =
        await programs.policyManager.account.protocolState.fetch(pda);
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
