"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { usePublicClient } from "wagmi";
import { INSURANCE_MANAGER_ADDRESS } from "./config";
import { insuranceManagerAbi } from "./abis/InsuranceManager";
import { useEthDemoMode } from "./useEthDemoMode";
import { getEthDemoPolicies } from "./demoData";
import type { IPoliciesHook, NormalizedPolicy } from "../types";

const COVERAGE_MAP: Record<number, "theftOnly" | "theftAndLoss"> = {
  0: "theftOnly",
  1: "theftAndLoss",
};

const FREQUENCY_MAP: Record<number, "monthly" | "annual"> = {
  0: "monthly",
  1: "annual",
};

const STATUS_MAP: Record<number, NormalizedPolicy["status"]> = {
  0: "active",
  1: "expired",
  2: "claimed",
  3: "cancelled",
  4: "suspended",
};

function normalizePolicy(raw: any): NormalizedPolicy {
  return {
    id: String(raw.policyId),
    owner: raw.customer,
    insuredValue: Number(raw.insuredValue) / 1e6,
    premium: Number(raw.premium) / 1e6,
    deductibleBps: Number(raw.deductibleBps),
    coverageType: COVERAGE_MAP[Number(raw.coverageType)] ?? "theftOnly",
    paymentFrequency: FREQUENCY_MAP[Number(raw.paymentFrequency)] ?? "monthly",
    status: STATUS_MAP[Number(raw.status)] ?? "active",
    durationDays: Math.round(
      (Number(raw.expiryDate) - Number(raw.startDate)) / 86400,
    ),
    startDate: Number(raw.startDate),
    endDate: Number(raw.expiryDate),
    totalPremiumsPaid: Number(raw.totalPaid) / 1e6,
  };
}

export function useEthPolicies(): IPoliciesHook {
  const { address } = useAccount();
  const demo = useEthDemoMode();
  const publicClient = usePublicClient();
  const [policies, setPolicies] = useState<NormalizedPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  // First get the customer's policy IDs
  const { data: policyIds, refetch } = useReadContract({
    address: INSURANCE_MANAGER_ADDRESS,
    abi: insuranceManagerAbi,
    functionName: "getCustomerPolicies",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !demo },
  });

  const refresh = useCallback(async () => {
    if (demo && address) {
      setPolicies(getEthDemoPolicies());
      setLoading(false);
      return;
    }
    if (!address) {
      setLoading(false);
      return;
    }
    await refetch();
  }, [demo, address, refetch]);

  useEffect(() => {
    if (demo && address) {
      setPolicies(getEthDemoPolicies());
      setLoading(false);
      return;
    }

    if (!policyIds || !publicClient) {
      setLoading(false);
      return;
    }

    const ids = policyIds as bigint[];
    if (ids.length === 0) {
      setPolicies([]);
      setLoading(false);
      return;
    }

    // Fetch each policy
    setLoading(true);
    Promise.all(
      ids.map(async (id) => {
        try {
          const result = await publicClient.readContract({
            address: INSURANCE_MANAGER_ADDRESS,
            abi: insuranceManagerAbi,
            functionName: "getPolicy",
            args: [id],
          });
          return normalizePolicy(result);
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      setPolicies(results.filter(Boolean) as NormalizedPolicy[]);
      setLoading(false);
    });
  }, [policyIds, publicClient, demo, address]);

  return { policies, loading, refresh };
}
