"use client";

import { useState, useEffect, useCallback } from "react";
import { useReadContracts } from "wagmi";
import { INSURANCE_MANAGER_ADDRESS } from "./config";
import { insuranceManagerAbi } from "./abis/InsuranceManager";
import { useEthDemoMode } from "./useEthDemoMode";
import { ethDemoProtocolState } from "./demoData";
import type { IDataHook, NormalizedProtocolState } from "../types";

const contract = {
  address: INSURANCE_MANAGER_ADDRESS,
  abi: insuranceManagerAbi,
} as const;

export function useEthProtocolState(): IDataHook<NormalizedProtocolState> {
  const demo = useEthDemoMode();
  const [data, setData] = useState<NormalizedProtocolState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: results, isLoading, refetch } = useReadContracts({
    contracts: [
      { ...contract, functionName: "totalPolicies" },
      { ...contract, functionName: "activePolicies" },
      { ...contract, functionName: "maxPolicies" },
      { ...contract, functionName: "platformFeeBps" },
      { ...contract, functionName: "maxInsuredValue" },
      { ...contract, functionName: "totalPremiumsCollected" },
      { ...contract, functionName: "paused" },
    ] as any,
    query: { enabled: !demo },
  });

  useEffect(() => {
    if (demo) {
      setData(ethDemoProtocolState);
      setError(null);
      return;
    }
    if (!results || results.length === 0) return;

    const r = results as { status: string; result?: unknown }[];
    const hasError = r.some((item) => item.status === "failure");
    if (hasError) {
      setError("Failed to read protocol state");
      return;
    }

    setData({
      totalPolicies: Number(r[0].result as bigint),
      activePolicies: Number(r[1].result as bigint),
      maxPolicies: Number(r[2].result as bigint),
      platformFeeBps: Number(r[3].result as bigint),
      maxInsuredValue: Number(r[4].result as bigint) / 1e6,
      totalPremiumsCollected: Number(r[5].result as bigint) / 1e6,
      paused: r[6].result as boolean,
    });
    setError(null);
  }, [results, demo]);

  const refresh = useCallback(async () => {
    if (!demo) await refetch();
  }, [demo, refetch]);

  return { data, loading: isLoading, error, refresh };
}
