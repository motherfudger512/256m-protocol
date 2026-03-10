"use client";

import { useChain } from "@/chains/ChainContext";

export function useCustomer() {
  const { adapter } = useChain();
  return adapter.useCustomer();
}
