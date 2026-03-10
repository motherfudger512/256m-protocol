"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits } from "viem";
import { LIQUIDITY_POOL_ADDRESS, STABLECOIN_ADDRESS } from "./config";
import { liquidityPoolAbi } from "./abis/LiquidityPool";
import { useEthDemoMode } from "./useEthDemoMode";
import { fakeEthTxHash } from "./demoData";
import type { ILPProviderActions } from "../types";

const erc20Abi = [
  {
    type: "function" as const,
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable" as const,
  },
] as const;

export function useEthLPProvider(): ILPProviderActions {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const demo = useEthDemoMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const exec = useCallback(
    async (fn: () => Promise<string>) => {
      setLoading(true);
      setError(null);
      setTxSignature(null);
      try {
        if (demo) {
          await new Promise((r) => setTimeout(r, 800));
          const hash = fakeEthTxHash();
          setTxSignature(hash);
          return hash;
        }
        const hash = await fn();
        setTxSignature(hash);
        return hash;
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Transaction failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [demo],
  );

  const depositStablecoin = useCallback(
    async (amount: number) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      return exec(async () => {
        const amountBase = parseUnits(String(amount), 6);

        // Step 1: Approve
        const approveHash = await walletClient.writeContract({
          address: STABLECOIN_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [LIQUIDITY_POOL_ADDRESS, amountBase],
        });
        await publicClient!.waitForTransactionReceipt({ hash: approveHash });

        // Step 2: Deposit with 0 minLPTokens (no slippage protection for simplicity)
        const hash = await walletClient.writeContract({
          address: LIQUIDITY_POOL_ADDRESS,
          abi: liquidityPoolAbi,
          functionName: "depositStablecoin",
          args: [amountBase, BigInt(0)],
        });
        await publicClient!.waitForTransactionReceipt({ hash });
        return hash;
      });
    },
    [walletClient, address, publicClient, exec],
  );

  // Ethereum does not support native token deposits
  // depositNative is undefined (not provided)

  const withdrawStablecoin = useCallback(
    async (lpTokens: number) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      return exec(async () => {
        const hash = await walletClient.writeContract({
          address: LIQUIDITY_POOL_ADDRESS,
          abi: liquidityPoolAbi,
          functionName: "withdrawStablecoin",
          args: [BigInt(lpTokens), BigInt(0)], // 0 minAmountOut
        });
        await publicClient!.waitForTransactionReceipt({ hash });
        return hash;
      });
    },
    [walletClient, address, publicClient, exec],
  );

  // withdrawNative is undefined (Ethereum doesn't support it)

  return {
    depositStablecoin,
    withdrawStablecoin,
    loading,
    error,
    txSignature,
  };
}
