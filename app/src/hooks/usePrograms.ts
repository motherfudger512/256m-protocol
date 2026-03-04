"use client";

import { useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";

import liquidityPoolIdl from "@/lib/programs/idl/liquidity_pool.json";
import policyManagerIdl from "@/lib/programs/idl/policy_manager.json";
import claimsProcessorIdl from "@/lib/programs/idl/claims_processor.json";
import treasuryIdl from "@/lib/programs/idl/treasury.json";

export function usePrograms() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
  }, [connection, wallet]);

  const programs = useMemo(() => {
    if (!provider) return null;

    return {
      liquidityPool: new Program(liquidityPoolIdl as any, provider),
      policyManager: new Program(policyManagerIdl as any, provider),
      claimsProcessor: new Program(claimsProcessorIdl as any, provider),
      treasury: new Program(treasuryIdl as any, provider),
    };
  }, [provider]);

  return { programs, provider };
}
