"use client";

import { useChain } from "@/chains/ChainContext";

export function useLPPosition() {
  const { adapter } = useChain();
  return adapter.useLPPosition();
}
