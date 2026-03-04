"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { usePrograms } from "@/hooks/usePrograms";
import { usePolicyholder } from "@/hooks/usePolicyholder";
import { useDemoMode } from "@/hooks/useDemoMode";
import { TransactionToast } from "@/components/shared/TransactionToast";
import { derivePolicy } from "@/lib/programs/pdas";
import { getDemoPolicies } from "@/lib/demoData";
import { baseToUsdc, getEnumVariant, formatTimestamp, usdcToBase, bpsToPercent } from "@/lib/formatting";

export default function PolicyDetailPage() {
  const params = useParams();
  const policyId = parseInt(params.policyId as string);
  const wallet = useAnchorWallet();
  const { programs } = usePrograms();
  const demo = useDemoMode();
  const { payPremium, cancelPolicy, loading, error, txSignature } = usePolicyholder();

  const [policy, setPolicy] = useState<any>(null);
  const [policyPda, setPolicyPda] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!wallet || isNaN(policyId)) return;

    if (demo) {
      const demoPolicies = getDemoPolicies(wallet.publicKey);
      const match = demoPolicies.find(
        (p) => p.account.policyId.toNumber() === policyId,
      );
      if (match) {
        setPolicyPda(match.publicKey);
        setPolicy(match.account);
      }
      setPageLoading(false);
      return;
    }

    if (!programs) return;
    const [pda] = derivePolicy(wallet.publicKey, policyId);
    setPolicyPda(pda);
    programs.policyManager.account.policy
      .fetch(pda)
      .then(setPolicy)
      .catch(() => setPolicy(null))
      .finally(() => setPageLoading(false));
  }, [programs, wallet, policyId, demo]);

  if (pageLoading) return <div className="text-gray-500">Loading...</div>;
  if (!policy) return <div className="text-gray-500">Policy not found</div>;

  const status = getEnumVariant(policy.status);
  const isActive = status === "active";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Policy #{policyId}</h2>
        <span
          className={`text-xs px-2 py-1 rounded ${
            isActive
              ? "bg-green-900 text-green-300"
              : status === "cancelled"
                ? "bg-red-900 text-red-300"
                : "bg-gray-800 text-gray-400"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Insured Value</div>
          <div className="text-lg font-semibold">{baseToUsdc(policy.insuredValue)} USDC</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Premium</div>
          <div className="text-lg font-semibold">{baseToUsdc(policy.premium)} USDC</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Coverage</div>
          <div className="text-lg font-semibold">{getEnumVariant(policy.coverageType)}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Deductible</div>
          <div className="text-lg font-semibold">{bpsToPercent(policy.deductibleBps)}%</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Total Paid</div>
          <div className="text-lg font-semibold">{baseToUsdc(policy.totalPremiumsPaid)} USDC</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Frequency</div>
          <div className="text-lg font-semibold">{getEnumVariant(policy.paymentFrequency)}</div>
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
                // User needs to provide their USDC ATA - this is a simplified version
                // In production, you'd derive/find the user's USDC ATA
                alert("To pay premium, you need a funded USDC token account. This requires the USDC mint address for your network.");
              }}
              disabled={loading || !payAmount}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium transition-colors"
            >
              {loading ? "Paying..." : "Pay"}
            </button>
          </div>

          <button
            onClick={() => policyPda && cancelPolicy(policyPda)}
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
