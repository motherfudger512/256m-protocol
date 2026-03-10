"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { LIQUIDITY_POOL_ADDRESS } from "./config";
import { liquidityPoolAbi } from "./abis/LiquidityPool";
import { lPTokenAbi } from "./abis/LPToken";
import { useEthDemoMode } from "./useEthDemoMode";
import { getEthDemoLPPosition } from "./demoData";
import type { IExistsHook, NormalizedLPPosition } from "../types";

export function useEthLPPosition(): IExistsHook<NormalizedLPPosition> {
  const { address } = useAccount();
  const demo = useEthDemoMode();
  const [data, setData] = useState<NormalizedLPPosition | null>(null);
  const [exists, setExists] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: results, isLoading, refetch } = useReadContracts({
    contracts: (address
      ? [
          {
            address: LIQUIDITY_POOL_ADDRESS,
            abi: liquidityPoolAbi,
            functionName: "getLPPosition",
            args: [address],
          },
          {
            address: LIQUIDITY_POOL_ADDRESS,
            abi: liquidityPoolAbi,
            functionName: "lpToken",
          },
        ]
      : []) as any,
    query: { enabled: !!address && !demo },
  });

  useEffect(() => {
    if (demo && address) {
      setData(getEthDemoLPPosition());
      setExists(true);
      return;
    }
    const r = results as { status: string; result?: unknown }[] | undefined;
    if (!r || r.length === 0 || !address) {
      setData(null);
      setExists(false);
      return;
    }

    const posResult = r[0];
    if (posResult.status === "failure") {
      setData(null);
      setExists(false);
      return;
    }

    const pos = posResult.result as any;
    const rewardsEarned = Number(pos.rewardsEarned ?? 0);

    // If no rewards and no distributions, position likely doesn't exist
    // We check LP token balance separately
    setData({
      owner: address,
      lpTokens: 0, // Will be updated from LP token balance
      usdcDeposited: 0,
      solDeposited: 0,
      rewardsEarned: rewardsEarned / 1e6,
      depositedAt: 0,
    });
    setExists(rewardsEarned > 0 || Number(pos.lastDistributionEpoch ?? 0) > 0);
  }, [results, demo, address]);

  const refresh = useCallback(async () => {
    if (!demo) await refetch();
  }, [demo, refetch]);

  return { data, exists, loading: isLoading, refresh };
}
