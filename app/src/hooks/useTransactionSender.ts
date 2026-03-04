"use client";

import { useCallback, useState } from "react";
import { useDemoMode } from "./useDemoMode";
import { fakeTxSignature } from "@/lib/demoData";

export function useTransactionSender() {
  const demo = useDemoMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const sendTransaction = useCallback(
    async (txFn: () => Promise<string>, onSuccess?: (sig: string) => void) => {
      setLoading(true);
      setError(null);
      setTxSignature(null);
      try {
        if (demo) {
          await new Promise((r) => setTimeout(r, 800));
          const sig = fakeTxSignature();
          setTxSignature(sig);
          onSuccess?.(sig);
          return sig;
        }
        const sig = await txFn();
        setTxSignature(sig);
        onSuccess?.(sig);
        return sig;
      } catch (err: any) {
        const parsed = parseAnchorError(err);
        setError(parsed || err.message || "Transaction failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [demo],
  );

  return { sendTransaction, loading, error, txSignature };
}

function parseAnchorError(err: any): string | null {
  if (err?.error?.errorMessage) {
    return err.error.errorMessage;
  }
  if (err?.logs) {
    const errorLog = (err.logs as string[]).find((l) =>
      l.includes("Error Code:"),
    );
    if (errorLog) return errorLog;
  }
  return null;
}
