"use client";

import { useState, useEffect, useCallback } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { usePrograms } from "./usePrograms";
import { useDemoMode } from "./useDemoMode";
import { deriveCustomer } from "@/lib/programs/pdas";
import { getDemoPolicies } from "@/lib/demoData";

export function usePolicies() {
  const wallet = useAnchorWallet();
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (demo && wallet) {
      setPolicies(getDemoPolicies(wallet.publicKey));
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
        await programs.policyManager.account.customer.fetch(customerPda);

      const policyAccounts = await Promise.all(
        (customer.policies as any[]).map(async (pubkey: any) => {
          try {
            const data =
              await programs.policyManager.account.policy.fetch(pubkey);
            return { publicKey: pubkey, account: data };
          } catch {
            return null;
          }
        }),
      );
      setPolicies(policyAccounts.filter(Boolean) as any[]);
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
