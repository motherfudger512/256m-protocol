"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { INSURANCE_MANAGER_ADDRESS } from "./config";
import { insuranceManagerAbi } from "./abis/InsuranceManager";
import { useEthDemoMode } from "./useEthDemoMode";
import { getEthDemoCustomer } from "./demoData";
import type { IExistsHook, NormalizedCustomer } from "../types";

export function useEthCustomer(): IExistsHook<NormalizedCustomer> {
  const { address } = useAccount();
  const demo = useEthDemoMode();
  const [data, setData] = useState<NormalizedCustomer | null>(null);
  const [exists, setExists] = useState(false);

  const { data: result, isLoading, refetch } = useReadContract({
    address: INSURANCE_MANAGER_ADDRESS,
    abi: insuranceManagerAbi,
    functionName: "getCustomer",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !demo },
  });

  useEffect(() => {
    if (demo && address) {
      setData(getEthDemoCustomer());
      setExists(true);
      return;
    }
    if (!result) {
      setData(null);
      setExists(false);
      return;
    }
    const customer = result as any;
    const createdAt = Number(customer.createdAt);
    if (createdAt === 0) {
      setData(null);
      setExists(false);
      return;
    }
    setData({
      owner: customer.owner,
      kycVerified: customer.kycVerified,
      policyCount: 0,
      totalClaims: Number(customer.totalClaims),
      createdAt,
    });
    setExists(true);
  }, [result, demo, address]);

  const refresh = useCallback(async () => {
    if (!demo) await refetch();
  }, [demo, refetch]);

  return { data, exists, loading: isLoading, refresh };
}
