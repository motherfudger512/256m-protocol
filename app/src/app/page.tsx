"use client";

import Link from "next/link";
import Image from "next/image";
import { WalletButton } from "@/components/wallet/WalletButton";
import { NetworkSwitcher } from "@/components/wallet/NetworkSwitcher";
import { useChain } from "@/chains/ChainContext";

export default function Home() {
  const { adapter } = useChain();
  const supportsNative = adapter.config.id === "solana";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <Image src="/logo.svg" alt="256M" width={120} height={25} priority />
        <div className="flex items-center gap-3">
          <NetworkSwitcher />
          <WalletButton />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
        <div className="text-center max-w-2xl">
          <h2 className="text-4xl font-bold mb-4">
            Decentralized Watch Insurance
          </h2>
          <p className="text-gray-400 text-lg">
            Protect your luxury timepieces with on-chain coverage backed by a
            decentralized liquidity pool.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <Link
            href="/policyholder"
            className="block p-6 rounded-xl border border-gray-800 hover:border-brand-500 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2">Policyholder</h3>
            <p className="text-gray-400 text-sm">
              Get a quote, insure your watches on-chain, pay premiums, and file
              claims.
            </p>
          </Link>

          <Link
            href="/lp"
            className="block p-6 rounded-xl border border-gray-800 hover:border-brand-500 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2">LP Provider</h3>
            <p className="text-gray-400 text-sm">
              Deposit {supportsNative ? "USDC or SOL" : "USDC"} into the liquidity pool to earn yields from
              premiums and interest.
            </p>
          </Link>
        </div>

        <Link
          href="/stats"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-700 bg-gray-900/60 text-sm text-gray-300 hover:border-brand-500 hover:text-white hover:bg-brand-600/10 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60">
            <rect x="1" y="8" width="3" height="7" rx="0.5" fill="currentColor" />
            <rect x="6" y="5" width="3" height="10" rx="0.5" fill="currentColor" />
            <rect x="11" y="1" width="3" height="14" rx="0.5" fill="currentColor" />
          </svg>
          View Protocol Stats
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-40">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </main>
    </div>
  );
}
