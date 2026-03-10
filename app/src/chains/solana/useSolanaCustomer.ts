"use client";

import { useState, useEffect, useCallback } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { usePrograms } from "@/hooks/usePrograms";
import { useDemoMode } from "@/hooks/useDemoMode";
import { deriveCustomer } from "@/lib/programs/pdas";
import { getDemoCustomer } from "@/lib/demoData";
import type { IExistsHook, NormalizedCustomer } from "../types";

function num(bn: any): number {
  return typeof bn === "number" ? bn : bn.toNumber();
}

function normalize(raw: any): NormalizedCustomer {
  return {
    owner: raw.owner.toBase58(),
    kycVerified: raw.kycVerified,
    policyCount: raw.policies?.length ?? num(raw.totalPolicies ?? 0),
    totalClaims: 0,
    createdAt: num(raw.createdAt),
  };
}

export function useSolanaCustomer(): IExistsHook<NormalizedCustomer> {
  const wallet = useAnchorWallet();
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const [data, setData] = useState<NormalizedCustomer | null>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (demo && wallet) {
      setData(normalize(getDemoCustomer(wallet.publicKey)));
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
      const [pda] = deriveCustomer(wallet.publicKey);
      const account =
        await (programs.policyManager.account as any).customer.fetch(pda);
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
