"use client";

import { useChain } from "@/chains/ChainContext";

interface Props {
  loading: boolean;
  error: string | null;
  txSignature: string | null;
}

export function TransactionToast({ loading, error, txSignature }: Props) {
  const { adapter } = useChain();
  const { explorerUrl, explorerTxPath } = adapter.config;

  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm">
        Confirming transaction...
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-200 max-w-md">
        {error}
      </div>
    );
  }

  if (txSignature) {
    const txUrl = `${explorerUrl}${explorerTxPath}${txSignature}`;
    return (
      <div className="fixed bottom-4 right-4 bg-green-900/50 border border-green-700 rounded-lg px-4 py-3 text-sm text-green-200">
        Transaction confirmed:{" "}
        <a
          href={txUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs underline hover:text-green-100"
        >
          {txSignature.slice(0, 8)}...
        </a>
      </div>
    );
  }

  return null;
}
