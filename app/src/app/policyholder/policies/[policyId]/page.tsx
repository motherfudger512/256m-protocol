"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { usePolicyholder } from "@/hooks/usePolicyholder";
import { usePolicies } from "@/hooks/usePolicies";
import { TransactionToast } from "@/components/shared/TransactionToast";
import { bpsToPercent, formatTimestamp } from "@/lib/formatting";

export default function PolicyDetailPage() {
  const params = useParams();
  const policyIdParam = params.policyId as string;
  const { policies, loading: policiesLoading } = usePolicies();
  const { payPremium, cancelPolicy, loading, error, txSignature } = usePolicyholder();

  const [payAmount, setPayAmount] = useState("");

  const policy = policies.find((p) => p.id === policyIdParam);

  if (policiesLoading) return <div className="text-gray-500">Loading...</div>;
  if (!policy) return <div className="text-gray-500">Policy not found</div>;

  const isActive = policy.status === "active";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Policy #{policy.id}</h2>
        <span
          className={`text-xs px-2 py-1 rounded ${
            isActive
              ? "bg-green-900 text-green-300"
              : policy.status === "cancelled"
                ? "bg-red-900 text-red-300"
                : "bg-gray-800 text-gray-400"
          }`}
        >
          {policy.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Insured Value</div>
          <div className="text-lg font-semibold">{policy.insuredValue.toLocaleString()} USDC</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Premium</div>
          <div className="text-lg font-semibold">{policy.premium.toLocaleString()} USDC</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Coverage</div>
          <div className="text-lg font-semibold">{policy.coverageType}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Deductible</div>
          <div className="text-lg font-semibold">{bpsToPercent(policy.deductibleBps)}%</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Total Paid</div>
          <div className="text-lg font-semibold">{policy.totalPremiumsPaid.toLocaleString()} USDC</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Frequency</div>
          <div className="text-lg font-semibold">{policy.paymentFrequency}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Start Date</div>
          <div className="text-lg font-semibold">{formatTimestamp(policy.startDate)}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Expiry Date</div>
          <div className="text-lg font-semibold">{formatTimestamp(policy.endDate)}</div>
        </div>
      </div>

      {isActive && (
        <div className="space-y-4 pt-4 border-t border-gray-800">
          <h3 className="font-semibold">Pay Premium</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Amount in USDC"
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <button
              onClick={async () => {
                if (!payAmount) return;
                try {
                  await payPremium(policy.id, parseFloat(payAmount));
                  setPayAmount("");
                } catch {
                  // error handled by hook
                }
              }}
              disabled={loading || !payAmount}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium transition-colors"
            >
              {loading ? "Paying..." : "Pay"}
            </button>
          </div>

          <button
            onClick={() => cancelPolicy(policy.id)}
            disabled={loading}
            className="w-full bg-red-900/50 hover:bg-red-900 border border-red-700 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium transition-colors text-red-200"
          >
            {loading ? "Cancelling..." : "Cancel Policy"}
          </button>
        </div>
      )}

      <TransactionToast loading={loading} error={error} txSignature={txSignature} />
    </div>
  );
}
