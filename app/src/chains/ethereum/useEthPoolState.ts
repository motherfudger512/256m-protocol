"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { LIQUIDITY_POOL_ADDRESS } from "./config";
import { liquidityPoolAbi } from "./abis/LiquidityPool";
import { useEthDemoMode } from "./useEthDemoMode";
import { ethDemoPoolState } from "./demoData";
import type { IDataHook, NormalizedPoolState } from "../types";

const contract = {
  address: LIQUIDITY_POOL_ADDRESS,
  abi: liquidityPoolAbi,
} as const;

export function useEthPoolState(): IDataHook<NormalizedPoolState> {
  const { address } = useAccount();
  const demo = useEthDemoMode();
  const [data, setData] = useState<NormalizedPoolState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: results, isLoading, refetch } = useReadContracts({
    contracts: [
      { ...contract, functionName: "totalCapitalStablecoin" },
      { ...contract, functionName: "totalLPSupply" },
      { ...contract, functionName: "lpFeeBps" },
      { ...contract, functionName: "totalPremiumsCollected" },
      { ...contract, functionName: "totalClaimsPaid" },
      { ...contract, functionName: "totalInterestEarned" },
      { ...contract, functionName: "totalDeployedCapital" },
      { ...contract, functionName: "scrCoverageRatioBps" },
      { ...contract, functionName: "paused" },
    ] as any,
    query: { enabled: !demo },
  });

  useEffect(() => {
    if (demo) {
      setData(ethDemoPoolState);
      setError(null);
      return;
    }
    if (!results || results.length === 0) return;

    const r = results as { status: string; result?: unknown }[];
    const hasError = r.some((item) => item.status === "failure");
    if (hasError) {
      setError("Failed to read pool state");
      return;
    }

    setData({
      totalCapitalUsdc: Number(r[0].result as bigint) / 1e6,
      totalCapitalSol: 0,
      totalLpSupply: Number(r[1].result as bigint),
      lpFeeBps: Number(r[2].result as bigint),
      totalPremiumsCollected: Number(r[3].result as bigint) / 1e6,
      totalClaimsPaid: Number(r[4].result as bigint) / 1e6,
      totalInterestEarned: Number(r[5].result as bigint) / 1e6,
      totalDeployedUsdc: Number(r[6].result as bigint) / 1e6,
      scrCoverageRatio: Number(r[7].result as bigint),
      paused: r[8].result as boolean,
      supportsNativeDeposit: false,
    });
    setError(null);
  }, [results, demo]);

  const refresh = useCallback(async () => {
    if (!demo) await refetch();
  }, [demo, refetch]);

  return { data, loading: isLoading, error, refresh };
}
