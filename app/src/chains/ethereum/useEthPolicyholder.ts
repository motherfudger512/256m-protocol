"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, encodeFunctionData, type Address } from "viem";
import { INSURANCE_MANAGER_ADDRESS, STABLECOIN_ADDRESS } from "./config";
import { insuranceManagerAbi } from "./abis/InsuranceManager";
import { useEthDemoMode } from "./useEthDemoMode";
import { fakeEthTxHash } from "./demoData";
import type { IPolicyholderActions, CreatePolicyParams } from "../types";

// Minimal ERC20 ABI for approve
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

export function useEthPolicyholder(): IPolicyholderActions {
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

  const registerCustomer = useCallback(
    async (kycHash: number[]) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      return exec(async () => {
        const bytes32 = ("0x" +
          kycHash.map((b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
        const hash = await walletClient.writeContract({
          address: INSURANCE_MANAGER_ADDRESS,
          abi: insuranceManagerAbi,
          functionName: "registerCustomer",
          args: [bytes32],
        });
        await publicClient!.waitForTransactionReceipt({ hash });
        return hash;
      });
    },
    [walletClient, address, publicClient, exec],
  );

  const createPolicy = useCallback(
    async (params: CreatePolicyParams) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      return exec(async () => {
        const bytes32 = ("0x" +
          params.watchDetailsHash
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")) as `0x${string}`;

        const coverageType = params.coverageType === "theftOnly" ? 0 : 1;
        const paymentFrequency = params.paymentFrequency === "monthly" ? 0 : 1;

        const hash = await walletClient.writeContract({
          address: INSURANCE_MANAGER_ADDRESS,
          abi: insuranceManagerAbi,
          functionName: "createPolicy",
          args: [
            bytes32,
            parseUnits(String(params.insuredValue), 6),
            parseUnits(String(params.premium), 6),
            params.deductibleBps,
            coverageType,
            paymentFrequency,
            params.durationDays,
          ],
        });
        await publicClient!.waitForTransactionReceipt({ hash });
        return hash;
      });
    },
    [walletClient, address, publicClient, exec],
  );

  const payPremium = useCallback(
    async (policyId: string, amount: number) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      return exec(async () => {
        const amountBase = parseUnits(String(amount), 6);

        // Step 1: Approve stablecoin
        const approveHash = await walletClient.writeContract({
          address: STABLECOIN_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [INSURANCE_MANAGER_ADDRESS, amountBase],
        });
        await publicClient!.waitForTransactionReceipt({ hash: approveHash });

        // Step 2: Pay premium
        const hash = await walletClient.writeContract({
          address: INSURANCE_MANAGER_ADDRESS,
          abi: insuranceManagerAbi,
          functionName: "payPremium",
          args: [BigInt(policyId), amountBase],
        });
        await publicClient!.waitForTransactionReceipt({ hash });
        return hash;
      });
    },
    [walletClient, address, publicClient, exec],
  );

  const cancelPolicy = useCallback(
    async (policyId: string) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      return exec(async () => {
        const hash = await walletClient.writeContract({
          address: INSURANCE_MANAGER_ADDRESS,
          abi: insuranceManagerAbi,
          functionName: "cancelPolicy",
          args: [BigInt(policyId)],
        });
        await publicClient!.waitForTransactionReceipt({ hash });
        return hash;
      });
    },
    [walletClient, address, publicClient, exec],
  );

  const submitClaim = useCallback(
    async (
      policyId: string,
      claimType: "theft" | "loss",
      documentsHash: number[],
      claimedAmount: number,
    ) => {
      if (!walletClient || !address) throw new Error("Wallet not connected");

      return exec(async () => {
        const claimTypeEnum = claimType === "theft" ? 0 : 1;
        const bytes32 = ("0x" +
          documentsHash
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")) as `0x${string}`;

        const hash = await walletClient.writeContract({
          address: INSURANCE_MANAGER_ADDRESS,
          abi: insuranceManagerAbi,
          functionName: "submitClaim",
          args: [
            BigInt(policyId),
            claimTypeEnum,
            bytes32,
            parseUnits(String(claimedAmount), 6),
          ],
        });
        await publicClient!.waitForTransactionReceipt({ hash });
        return hash;
      });
    },
    [walletClient, address, publicClient, exec],
  );

  return {
    registerCustomer,
    createPolicy,
    payPremium,
    cancelPolicy,
    submitClaim,
    loading,
    error,
    txSignature,
  };
}
