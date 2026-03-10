"use client";

import Link from "next/link";
import { useClaimsState } from "@/hooks/useClaimsState";

export default function ClaimsListPage() {
  const { data: claimsState, loading } = useClaimsState();

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Claims</h2>
        <Link
          href="/policyholder/claims/new"
          className="bg-brand-600 hover:bg-brand-700 rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          File Claim
        </Link>
      </div>

      {claimsState && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-sm text-gray-400">Total Claims</div>
            <div className="text-lg font-semibold">
              {claimsState.totalClaims}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-sm text-gray-400">Approved</div>
            <div className="text-lg font-semibold text-green-400">
              {claimsState.approvedClaims}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-sm text-gray-400">Rejected</div>
            <div className="text-lg font-semibold text-red-400">
              {claimsState.rejectedClaims}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-sm text-gray-400">Total Paid Out</div>
            <div className="text-lg font-semibold">
              {claimsState.totalPaidOut.toLocaleString()} USDC
            </div>
          </div>
        </div>
      )}

      <p className="text-gray-500 text-sm">
        Your individual claims can be tracked by their claim ID after submission.
        Use the File Claim page to submit a new claim against an active policy.
      </p>
    </div>
  );
}
