"use client";

import { useChain } from "@/chains/ChainContext";

export function usePolicyholder() {
  const { adapter } = useChain();
  return adapter.usePolicyholder();
}
