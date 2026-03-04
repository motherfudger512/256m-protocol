"use client";

import { useCallback } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import BN from "bn.js";
import { usePrograms } from "./usePrograms";
import { useTransactionSender } from "./useTransactionSender";
import { useDemoMode } from "./useDemoMode";
import {
  derivePoolState,
  derivePoolVaultUsdc,
  derivePoolVaultSol,
  deriveLpTokenMint,
  deriveLpPosition,
} from "@/lib/programs/pdas";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@/lib/constants";

export function useLPProvider() {
  const wallet = useAnchorWallet();
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const { sendTransaction, loading, error, txSignature } =
    useTransactionSender();

  const depositUsdc = useCallback(
    async (amount: BN, userUsdcAta: PublicKey) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const [poolState] = derivePoolState();
      const [lpPosition] = deriveLpPosition(wallet.publicKey);
      const [poolVaultUsdc] = derivePoolVaultUsdc();
      const [lpTokenMint] = deriveLpTokenMint();
      const userLpTokenAta = await getAssociatedTokenAddress(
        lpTokenMint,
        wallet.publicKey,
      );

      return sendTransaction(async () => {
        return programs.liquidityPool.methods
          .depositLpUsdc(amount)
          .accounts({
            poolState,
            lpPosition,
            poolVaultUsdc,
            lpTokenMint,
            depositorUsdc: userUsdcAta,
            depositorLpToken: userLpTokenAta,
            depositor: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      });
    },
    [programs, wallet, sendTransaction, demo],
  );

  const depositSol = useCallback(
    async (amount: BN) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const [poolState] = derivePoolState();
      const [lpPosition] = deriveLpPosition(wallet.publicKey);
      const [poolVaultSol] = derivePoolVaultSol();
      const [lpTokenMint] = deriveLpTokenMint();
      const userLpTokenAta = await getAssociatedTokenAddress(
        lpTokenMint,
        wallet.publicKey,
      );

      return sendTransaction(async () => {
        return programs.liquidityPool.methods
          .depositLpSol(amount)
          .accounts({
            poolState,
            lpPosition,
            poolVaultSol,
            lpTokenMint,
            depositorLpToken: userLpTokenAta,
            depositor: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      });
    },
    [programs, wallet, sendTransaction, demo],
  );

  const withdrawUsdc = useCallback(
    async (lpTokens: BN, userUsdcAta: PublicKey) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const [poolState] = derivePoolState();
      const [lpPosition] = deriveLpPosition(wallet.publicKey);
      const [poolVaultUsdc] = derivePoolVaultUsdc();
      const [lpTokenMint] = deriveLpTokenMint();
      const userLpTokenAta = await getAssociatedTokenAddress(
        lpTokenMint,
        wallet.publicKey,
      );

      return sendTransaction(async () => {
        return programs.liquidityPool.methods
          .withdrawLpUsdc(lpTokens)
          .accounts({
            poolState,
            lpPosition,
            poolVaultUsdc,
            lpTokenMint,
            withdrawerUsdc: userUsdcAta,
            withdrawerLpToken: userLpTokenAta,
            withdrawer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      });
    },
    [programs, wallet, sendTransaction, demo],
  );

  const withdrawSol = useCallback(
    async (lpTokens: BN) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const [poolState] = derivePoolState();
      const [lpPosition] = deriveLpPosition(wallet.publicKey);
      const [poolVaultSol] = derivePoolVaultSol();
      const [lpTokenMint] = deriveLpTokenMint();
      const userLpTokenAta = await getAssociatedTokenAddress(
        lpTokenMint,
        wallet.publicKey,
      );

      return sendTransaction(async () => {
        return programs.liquidityPool.methods
          .withdrawLpSol(lpTokens)
          .accounts({
            poolState,
            lpPosition,
            poolVaultSol,
            lpTokenMint,
            withdrawerLpToken: userLpTokenAta,
            withdrawer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      });
    },
    [programs, wallet, sendTransaction, demo],
  );

  return {
    depositUsdc,
    depositSol,
    withdrawUsdc,
    withdrawSol,
    loading,
    error,
    txSignature,
  };
}
