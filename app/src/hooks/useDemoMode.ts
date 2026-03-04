"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { DemoWalletName } from "@/components/wallet/DemoWalletAdapter";

export function useDemoMode(): boolean {
  const { wallet } = useWallet();
  return wallet?.adapter?.name === DemoWalletName;
}
