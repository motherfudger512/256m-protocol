"use client";

import { useChain } from "@/chains/ChainContext";

export function usePoolState() {
  const { adapter } = useChain();
  return adapter.usePoolState();
}
