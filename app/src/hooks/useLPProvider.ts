"use client";

import { useChain } from "@/chains/ChainContext";

export function useLPProvider() {
  const { adapter } = useChain();
  return adapter.useLPProvider();
}
