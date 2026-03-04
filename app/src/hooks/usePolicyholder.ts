"use client";

import { useCallback } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { usePrograms } from "./usePrograms";
import { useTransactionSender } from "./useTransactionSender";
import { useDemoMode } from "./useDemoMode";
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

export function usePolicyholder() {
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
        return programs.policyManager.methods
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
    async (params: {
      watchDetailsHash: number[];
      insuredValue: BN;
      premium: BN;
      deductibleBps: number;
      coverageType: { theftOnly: {} } | { theftAndLoss: {} };
      paymentFrequency: { monthly: {} } | { annual: {} };
      durationDays: number;
    }) => {
      if (!wallet) throw new Error("Wallet not connected");

      if (demo) {
        return sendTransaction(async () => "");
      }

      if (!programs) throw new Error("Programs not loaded");

      const [protocolState] = deriveProtocolState();
      const [customerPda] = deriveCustomer(wallet.publicKey);

      // Fetch current total to derive next policy PDA
      const currentState =
        await programs.policyManager.account.protocolState.fetch(protocolState);
      const nextPolicyId = currentState.totalPolicies.toNumber() + 1;
      const [policyPda] = derivePolicy(wallet.publicKey, nextPolicyId);

      return sendTransaction(async () => {
        return programs.policyManager.methods
          .createPolicy(
            params.watchDetailsHash,
            params.insuredValue,
            params.premium,
            params.deductibleBps,
            params.coverageType,
            params.paymentFrequency,
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
    async (policyPda: PublicKey, amount: BN, userUsdcAta: PublicKey) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const [protocolState] = deriveProtocolState();
      const [treasuryVaultUsdc] = deriveTreasuryVaultUsdc();
      const [poolVaultUsdc] = derivePoolVaultUsdc();

      return sendTransaction(async () => {
        return programs.policyManager.methods
          .payPremium(amount)
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
    async (policyPda: PublicKey) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const [protocolState] = deriveProtocolState();
      const [customerPda] = deriveCustomer(wallet.publicKey);

      return sendTransaction(async () => {
        return programs.policyManager.methods
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
      policyPda: PublicKey,
      claimType: { theft: {} } | { loss: {} },
      documentsHash: number[],
      claimedAmount: BN,
    ) => {
      if (!wallet) throw new Error("Wallet not connected");

      if (demo) {
        return sendTransaction(async () => "");
      }

      if (!programs) throw new Error("Programs not loaded");

      const [claimsState] = deriveClaimsState();

      // Fetch current total to derive next claim PDA
      const currentClaimsState =
        await programs.claimsProcessor.account.claimsState.fetch(claimsState);
      const nextClaimId = currentClaimsState.totalClaims.toNumber() + 1;
      const [claimPda] = deriveClaim(policyPda, nextClaimId);

      return sendTransaction(async () => {
        return programs.claimsProcessor.methods
          .submitClaim(claimType, documentsHash, claimedAmount)
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
