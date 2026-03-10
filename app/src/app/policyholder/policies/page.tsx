"use client";

import Link from "next/link";
import { usePolicies } from "@/hooks/usePolicies";

export default function PoliciesListPage() {
  const { policies, loading } = usePolicies();

  if (loading) return <div className="text-gray-500">Loading policies...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Your Policies</h2>
        <Link
          href="/policyholder/policies/new"
          className="bg-brand-600 hover:bg-brand-700 rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          Create Policy
        </Link>
      </div>

      {policies.length === 0 ? (
        <div className="text-gray-500">
          No policies yet. Create your first policy to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((p, i) => (
            <Link
              key={i}
              href={`/policyholder/policies/${p.id}`}
              className="block bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    Policy #{p.id}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    Coverage: {p.coverageType} &middot;
                    Insured: {p.insuredValue.toLocaleString()} USDC &middot;
                    Premium: {p.premium.toLocaleString()} USDC
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total paid: {p.totalPremiumsPaid.toLocaleString()} USDC
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    p.status === "active"
                      ? "bg-green-900 text-green-300"
                      : p.status === "cancelled"
                        ? "bg-red-900 text-red-300"
                        : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
