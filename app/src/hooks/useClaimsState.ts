"use client";

import { useChain } from "@/chains/ChainContext";

export function useClaimsState() {
  const { adapter } = useChain();
  return adapter.useClaimsState();
}
