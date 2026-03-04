"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useMemo } from "react";

export function WalletButton() {
  const { publicKey, wallet, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  const connected = !!publicKey;

  const shortAddress = useMemo(() => {
    if (!publicKey) return "";
    const b58 = publicKey.toBase58();
    return `${b58.slice(0, 4)}..${b58.slice(-4)}`;
  }, [publicKey]);

  const handleClick = useCallback(() => {
    if (connected) {
      disconnect();
    } else {
      setVisible(true);
    }
  }, [connected, disconnect, setVisible]);

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

  /* ── Disconnected: bold brand CTA ── */
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

  /* ── Connected: subtle, blends with background ── */
  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800/50 text-gray-500 border border-gray-800 hover:bg-gray-800 hover:text-gray-300 transition-colors"
      title="Disconnect wallet"
    >
      {wallet?.adapter.icon && (
        <img
          src={wallet.adapter.icon}
          alt=""
          width={16}
          height={16}
          className="rounded-sm opacity-50"
        />
      )}
      {shortAddress}
    </button>
  );
}
