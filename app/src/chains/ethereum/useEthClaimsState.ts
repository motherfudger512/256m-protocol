"use client";

import { useState, useEffect, useCallback } from "react";
import { useReadContracts } from "wagmi";
import { INSURANCE_MANAGER_ADDRESS } from "./config";
import { insuranceManagerAbi } from "./abis/InsuranceManager";
import { useEthDemoMode } from "./useEthDemoMode";
import { ethDemoClaimsState } from "./demoData";
import type { IDataHook, NormalizedClaimsState } from "../types";

const contract = {
  address: INSURANCE_MANAGER_ADDRESS,
  abi: insuranceManagerAbi,
} as const;

export function useEthClaimsState(): IDataHook<NormalizedClaimsState> {
  const demo = useEthDemoMode();
  const [data, setData] = useState<NormalizedClaimsState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: results, isLoading, refetch } = useReadContracts({
    contracts: [
      { ...contract, functionName: "totalClaims" },
      { ...contract, functionName: "approvedClaims" },
      { ...contract, functionName: "rejectedClaims" },
      { ...contract, functionName: "totalClaimsPaidOut" },
      { ...contract, functionName: "maxAutoPayoutAmount" },
      { ...contract, functionName: "dailyAutoPayoutLimit" },
      { ...contract, functionName: "paused" },
    ] as any,
    query: { enabled: !demo },
  });

  useEffect(() => {
    if (demo) {
      setData(ethDemoClaimsState);
      setError(null);
      return;
    }
    if (!results || results.length === 0) return;

    const r = results as { status: string; result?: unknown }[];
    const hasError = r.some((item) => item.status === "failure");
    if (hasError) {
      setError("Failed to read claims state");
      return;
    }

    setData({
      totalClaims: Number(r[0].result as bigint),
      approvedClaims: Number(r[1].result as bigint),
      rejectedClaims: Number(r[2].result as bigint),
      totalPaidOut: Number(r[3].result as bigint) / 1e6,
      maxAutoPayout: Number(r[4].result as bigint) / 1e6,
      dailyAutoPayoutLimit: Number(r[5].result as bigint) / 1e6,
      paused: r[6].result as boolean,
    });
    setError(null);
  }, [results, demo]);

  const refresh = useCallback(async () => {
    if (!demo) await refetch();
  }, [demo, refetch]);

  return { data, loading: isLoading, error, refresh };
}
