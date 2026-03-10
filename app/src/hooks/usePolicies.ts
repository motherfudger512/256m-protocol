"use client";

import { useChain } from "@/chains/ChainContext";

export function usePolicies() {
  const { adapter } = useChain();
  return adapter.usePolicies();
}
