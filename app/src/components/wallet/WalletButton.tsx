"use client";

import { useChain } from "@/chains/ChainContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useMemo } from "react";

export function WalletButton() {
  const { adapter, activeChain } = useChain();
  const { connected, connecting, walletAddress } = adapter;

  // Solana-specific: wallet icon
  const { wallet: solWallet } = useWallet();

  const shortAddress = useMemo(() => {
    if (!walletAddress) return "";
    if (activeChain === "ethereum") {
      return `${walletAddress.slice(0, 6)}..${walletAddress.slice(-4)}`;
    }
    return `${walletAddress.slice(0, 4)}..${walletAddress.slice(-4)}`;
  }, [walletAddress, activeChain]);

  const handleClick = useCallback(() => {
    if (connected) {
      adapter.disconnect();
    } else {
      adapter.connect();
    }
  }, [connected, adapter]);

  if (connecting) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-500/20 text-brand-300 cursor-wait"
      >
        <span className="inline-block w-3 h-3 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
        Connecting...
      </button>
    );
  }

  if (!connected) {
    return (
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-brand-500 text-white hover:bg-brand-400 transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="opacity-80"
        >
          <path
            d="M13 4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 8.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z"
            fill="currentColor"
          />
          <path
            d="M2 6V4a2 2 0 0 1 2-2h7"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Connect Wallet
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800/50 text-gray-500 border border-gray-800 hover:bg-gray-800 hover:text-gray-300 transition-colors"
      title="Disconnect wallet"
    >
      {activeChain === "solana" && solWallet?.adapter.icon && (
        <img
          src={solWallet.adapter.icon}
          alt=""
          width={16}
          height={16}
          className="rounded-sm opacity-50"
        />
      )}
      {activeChain === "ethereum" && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-50">
          <path d="M8 1L3 8l5 3 5-3L8 1z" fill="currentColor" opacity="0.6" />
          <path d="M8 12l-5-3 5 4 5-4-5 3z" fill="currentColor" opacity="0.4" />
        </svg>
      )}
      {shortAddress}
    </button>
  );
}
