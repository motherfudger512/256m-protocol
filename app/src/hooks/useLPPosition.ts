"use client";

import { useState, useEffect, useCallback } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { usePrograms } from "./usePrograms";
import { useDemoMode } from "./useDemoMode";
import { deriveLpPosition } from "@/lib/programs/pdas";
import { getDemoLpPosition } from "@/lib/demoData";

export function useLPPosition() {
  const wallet = useAnchorWallet();
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const [data, setData] = useState<any>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (demo && wallet) {
      setData(getDemoLpPosition(wallet.publicKey));
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
        await programs.liquidityPool.account.lpPosition.fetch(pda);
      setData(account);
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
