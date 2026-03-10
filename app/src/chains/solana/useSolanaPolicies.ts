"use client";

import { useState, useEffect, useCallback } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { usePrograms } from "@/hooks/usePrograms";
import { useDemoMode } from "@/hooks/useDemoMode";
import { deriveCustomer } from "@/lib/programs/pdas";
import { getDemoPolicies } from "@/lib/demoData";
import type { IPoliciesHook, NormalizedPolicy } from "../types";
import { getEnumVariant } from "@/lib/formatting";

function num(bn: any): number {
  return typeof bn === "number" ? bn : bn.toNumber();
}

function normalizePolicy(raw: any): NormalizedPolicy {
  const account = raw.account ?? raw;
  return {
    id: (raw.publicKey ?? account.policyId)?.toString?.() ?? String(num(account.policyId)),
    owner: account.owner?.toBase58?.() ?? String(account.owner),
    insuredValue: num(account.insuredValue) / 1e6,
    premium: num(account.premium) / 1e6,
    deductibleBps: account.deductibleBps,
    coverageType: getEnumVariant(account.coverageType) as "theftOnly" | "theftAndLoss",
    paymentFrequency: getEnumVariant(account.paymentFrequency) as "monthly" | "annual",
    status: getEnumVariant(account.status) as NormalizedPolicy["status"],
    durationDays: account.durationDays,
    startDate: num(account.startDate),
    endDate: num(account.endDate),
    totalPremiumsPaid: num(account.totalPremiumsPaid) / 1e6,
  };
}

export function useSolanaPolicies(): IPoliciesHook {
  const wallet = useAnchorWallet();
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const [policies, setPolicies] = useState<NormalizedPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (demo && wallet) {
      setPolicies(getDemoPolicies(wallet.publicKey).map(normalizePolicy));
      setLoading(false);
      return;
    }
    if (!programs || !wallet) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [customerPda] = deriveCustomer(wallet.publicKey);
      const customer =
        await (programs.policyManager.account as any).customer.fetch(customerPda);

      const policyAccounts = await Promise.all(
        (customer.policies as any[]).map(async (pubkey: any) => {
          try {
            const data =
              await (programs.policyManager.account as any).policy.fetch(pubkey);
            return normalizePolicy({ publicKey: pubkey, account: data });
          } catch {
            return null;
          }
        }),
      );
      setPolicies(policyAccounts.filter(Boolean) as NormalizedPolicy[]);
    } catch {
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [programs, wallet, demo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { policies, loading, refresh };
}
