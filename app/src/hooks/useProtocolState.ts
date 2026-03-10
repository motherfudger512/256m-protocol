"use client";

import { useChain } from "@/chains/ChainContext";

export function useProtocolState() {
  const { adapter } = useChain();
  return adapter.useProtocolState();
}
