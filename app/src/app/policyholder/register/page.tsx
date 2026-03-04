"use client";

import { useState } from "react";
import { usePolicyholder } from "@/hooks/usePolicyholder";
import { useCustomer } from "@/hooks/useCustomer";
import { TransactionToast } from "@/components/shared/TransactionToast";

export default function RegisterPage() {
  const { registerCustomer, loading, error, txSignature } = usePolicyholder();
  const { exists, refresh, loading: customerLoading } = useCustomer();
  const [kycInput, setKycInput] = useState("");

  if (customerLoading) return <div className="text-gray-500">Loading...</div>;

  if (exists) {
    return (
      <div className="max-w-lg">
        <h2 className="text-2xl font-bold mb-4">Already Registered</h2>
        <p className="text-gray-400">
          Your customer account already exists. Go to the Dashboard or create a
          new policy.
        </p>
      </div>
    );
  }

  const handleRegister = async () => {
    try {
      // Create a 32-byte hash from the input (or use zeros if empty)
      const hashBytes = kycInput
        ? Array.from(
            Buffer.from(kycInput.padEnd(32, "\0").slice(0, 32), "utf-8"),
          )
        : Array.from(Buffer.alloc(32, 0xab));

      await registerCustomer(hashBytes);
      await refresh();
    } catch {
      // error handled by hook
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold mb-4">Register as Customer</h2>
      <p className="text-gray-400 mb-6">
        Register your wallet as a 256M customer. An admin will verify your KYC
        before you can create policies.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            KYC Reference (optional)
          </label>
          <input
            type="text"
            value={kycInput}
            onChange={(e) => setKycInput(e.target.value)}
            placeholder="Enter KYC reference ID"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </div>

      <TransactionToast loading={loading} error={error} txSignature={txSignature} />
    </div>
  );
}
