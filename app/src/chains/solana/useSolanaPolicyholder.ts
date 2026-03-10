"use client";

import { useCallback } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { usePrograms } from "@/hooks/usePrograms";
import { useTransactionSender } from "@/hooks/useTransactionSender";
import { useDemoMode } from "@/hooks/useDemoMode";
import {
  deriveProtocolState,
  deriveCustomer,
  derivePolicy,
  deriveClaimsState,
  deriveClaim,
  deriveTreasuryVaultUsdc,
  derivePoolVaultUsdc,
} from "@/lib/programs/pdas";
import { TOKEN_PROGRAM_ID } from "@/lib/constants";
import { usdcToBase } from "@/lib/formatting";
import type { IPolicyholderActions, CreatePolicyParams } from "../types";

export function useSolanaPolicyholder(): IPolicyholderActions {
  const wallet = useAnchorWallet();
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const { sendTransaction, loading, error, txSignature } =
    useTransactionSender();

  const registerCustomer = useCallback(
    async (kycHash: number[]) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const [customerPda] = deriveCustomer(wallet.publicKey);

      return sendTransaction(async () => {
        return (programs.policyManager as any).methods
          .registerCustomer(kycHash)
          .accounts({
            customer: customerPda,
            owner: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      });
    },
    [programs, wallet, sendTransaction, demo],
  );

  const createPolicy = useCallback(
    async (params: CreatePolicyParams) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const [protocolState] = deriveProtocolState();
      const [customerPda] = deriveCustomer(wallet.publicKey);

      const currentState =
        await (programs.policyManager.account as any).protocolState.fetch(protocolState);
      const nextPolicyId = currentState.totalPolicies.toNumber() + 1;
      const [policyPda] = derivePolicy(wallet.publicKey, nextPolicyId);

      const coverageType =
        params.coverageType === "theftOnly"
          ? { theftOnly: {} }
          : { theftAndLoss: {} };
      const paymentFrequency =
        params.paymentFrequency === "monthly"
          ? { monthly: {} }
          : { annual: {} };

      return sendTransaction(async () => {
        return (programs.policyManager as any).methods
          .createPolicy(
            params.watchDetailsHash,
            usdcToBase(params.insuredValue),
            usdcToBase(params.premium),
            params.deductibleBps,
            coverageType,
            paymentFrequency,
            params.durationDays,
          )
          .accounts({
            protocolState,
            customer: customerPda,
            policy: policyPda,
            payer: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      });
    },
    [programs, wallet, sendTransaction, demo],
  );

  const payPremium = useCallback(
    async (policyId: string, amount: number) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const policyPda = new PublicKey(policyId);
      const [protocolState] = deriveProtocolState();
      const [treasuryVaultUsdc] = deriveTreasuryVaultUsdc();
      const [poolVaultUsdc] = derivePoolVaultUsdc();

      // Derive the user's USDC ATA
      const { getAssociatedTokenAddress } = await import("@solana/spl-token");
      const usdcMint = new PublicKey(
        process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      );
      const userUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        wallet.publicKey,
      );

      return sendTransaction(async () => {
        return (programs.policyManager as any).methods
          .payPremium(usdcToBase(amount))
          .accounts({
            protocolState,
            policy: policyPda,
            payerTokenAccount: userUsdcAta,
            treasuryTokenAccount: treasuryVaultUsdc,
            poolVault: poolVaultUsdc,
            payer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      });
    },
    [programs, wallet, sendTransaction, demo],
  );

  const cancelPolicy = useCallback(
    async (policyId: string) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const policyPda = new PublicKey(policyId);
      const [protocolState] = deriveProtocolState();
      const [customerPda] = deriveCustomer(wallet.publicKey);

      return sendTransaction(async () => {
        return (programs.policyManager as any).methods
          .cancelPolicy()
          .accounts({
            protocolState,
            customer: customerPda,
            policy: policyPda,
            signer: wallet.publicKey,
          })
          .rpc();
      });
    },
    [programs, wallet, sendTransaction, demo],
  );

  const submitClaim = useCallback(
    async (
      policyId: string,
      claimType: "theft" | "loss",
      documentsHash: number[],
      claimedAmount: number,
    ) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const policyPda = new PublicKey(policyId);
      const anchorClaimType =
        claimType === "theft" ? { theft: {} } : { loss: {} };

      const [claimsState] = deriveClaimsState();
      const currentClaimsState =
        await (programs.claimsProcessor.account as any).claimsState.fetch(claimsState);
      const nextClaimId = currentClaimsState.totalClaims.toNumber() + 1;
      const [claimPda] = deriveClaim(policyPda, nextClaimId);

      return sendTransaction(async () => {
        return (programs.claimsProcessor as any).methods
          .submitClaim(anchorClaimType, documentsHash, usdcToBase(claimedAmount))
          .accounts({
            claimsState,
            policy: policyPda,
            claim: claimPda,
            customer: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      });
    },
    [programs, wallet, sendTransaction, demo],
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
