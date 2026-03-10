"use client";

import { useCallback } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { usePrograms } from "@/hooks/usePrograms";
import { useTransactionSender } from "@/hooks/useTransactionSender";
import { useDemoMode } from "@/hooks/useDemoMode";
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
import { usdcToBase, solToLamports } from "@/lib/formatting";
import type { ILPProviderActions } from "../types";

export function useSolanaLPProvider(): ILPProviderActions {
  const wallet = useAnchorWallet();
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const { sendTransaction, loading, error, txSignature } =
    useTransactionSender();

  const depositStablecoin = useCallback(
    async (amount: number) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const [poolState] = derivePoolState();
      const [lpPosition] = deriveLpPosition(wallet.publicKey);
      const [poolVaultUsdc] = derivePoolVaultUsdc();
      const [lpTokenMint] = deriveLpTokenMint();

      const usdcMint = new PublicKey(
        process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      );
      const userUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        wallet.publicKey,
      );
      const userLpTokenAta = await getAssociatedTokenAddress(
        lpTokenMint,
        wallet.publicKey,
      );

      return sendTransaction(async () => {
        return (programs.liquidityPool as any).methods
          .depositLpUsdc(usdcToBase(amount))
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

  const depositNative = useCallback(
    async (amount: number) => {
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
        return (programs.liquidityPool as any).methods
          .depositLpSol(solToLamports(amount))
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

  const withdrawStablecoin = useCallback(
    async (lpTokens: number) => {
      if (!wallet) throw new Error("Wallet not connected");
      if (demo) return sendTransaction(async () => "");
      if (!programs) throw new Error("Programs not loaded");

      const [poolState] = derivePoolState();
      const [lpPosition] = deriveLpPosition(wallet.publicKey);
      const [poolVaultUsdc] = derivePoolVaultUsdc();
      const [lpTokenMint] = deriveLpTokenMint();

      const usdcMint = new PublicKey(
        process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      );
      const userUsdcAta = await getAssociatedTokenAddress(
        usdcMint,
        wallet.publicKey,
      );
      const userLpTokenAta = await getAssociatedTokenAddress(
        lpTokenMint,
        wallet.publicKey,
      );

      const BN = (await import("bn.js")).default;

      return sendTransaction(async () => {
        return (programs.liquidityPool as any).methods
          .withdrawLpUsdc(new BN(lpTokens))
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

  const withdrawNative = useCallback(
    async (lpTokens: number) => {
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

      const BN = (await import("bn.js")).default;

      return sendTransaction(async () => {
        return (programs.liquidityPool as any).methods
          .withdrawLpSol(new BN(lpTokens))
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
    depositStablecoin,
    depositNative,
    withdrawStablecoin,
    withdrawNative,
    loading,
    error,
    txSignature,
  };
}
