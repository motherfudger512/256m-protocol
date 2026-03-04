"use client";

interface Props {
  loading: boolean;
  error: string | null;
  txSignature: string | null;
}

export function TransactionToast({ loading, error, txSignature }: Props) {
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
    return (
      <div className="fixed bottom-4 right-4 bg-green-900/50 border border-green-700 rounded-lg px-4 py-3 text-sm text-green-200">
        Transaction confirmed:{" "}
        <span className="font-mono text-xs">
          {txSignature.slice(0, 8)}...
        </span>
      </div>
    );
  }

  return null;
}
