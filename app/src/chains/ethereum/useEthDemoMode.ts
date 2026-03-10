"use client";

import { useAccount } from "wagmi";

// Hardhat/Anvil default accounts
const DEMO_ADDRESSES = new Set([
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
]);

export function useEthDemoMode(): boolean {
  const { address } = useAccount();
  if (process.env.NEXT_PUBLIC_ETH_DEMO_MODE === "true") return true;
  if (address && DEMO_ADDRESSES.has(address)) return true;
  return false;
}
