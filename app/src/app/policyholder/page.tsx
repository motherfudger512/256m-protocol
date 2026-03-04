"use client";

import { useCustomer } from "@/hooks/useCustomer";
import { usePolicies } from "@/hooks/usePolicies";
import { baseToUsdc, getEnumVariant, formatTimestamp } from "@/lib/formatting";

export default function PolicyholderDashboard() {
  const { data: customer, exists, loading: customerLoading } = useCustomer();
  const { policies, loading: policiesLoading } = usePolicies();

  if (customerLoading) return <div className="text-gray-500">Loading...</div>;

  if (!exists) {
    return (
      <div className="max-w-lg">
        <h2 className="text-2xl font-bold mb-4">Welcome</h2>
        <p className="text-gray-400 mb-4">
          You need to register as a customer before creating policies. Go to the
          Register page to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">KYC Status</div>
          <div
            className={`text-lg font-semibold ${customer.kycVerified ? "text-green-400" : "text-yellow-400"}`}
          >
            {customer.kycVerified ? "Verified" : "Pending"}
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Total Policies</div>
          <div className="text-lg font-semibold">
            {customer.policies?.length || 0}
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-sm text-gray-400">Total Claims</div>
          <div className="text-lg font-semibold">
            {customer.totalClaims?.toNumber() || 0}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Your Policies</h3>
        {policiesLoading ? (
          <div className="text-gray-500">Loading policies...</div>
        ) : policies.length === 0 ? (
          <div className="text-gray-500">No policies yet</div>
        ) : (
          <div className="space-y-2">
            {policies.map((p: any, i: number) => (
              <div
                key={i}
                className="bg-gray-900 rounded-lg p-4 border border-gray-800 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">
                    Policy #{p.account.policyId.toNumber()}
                  </div>
                  <div className="text-sm text-gray-400">
                    {getEnumVariant(p.account.coverageType)} &middot; Insured:{" "}
                    {baseToUsdc(p.account.insuredValue)} USDC
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    getEnumVariant(p.account.status) === "active"
                      ? "bg-green-900 text-green-300"
                      : getEnumVariant(p.account.status) === "cancelled"
                        ? "bg-red-900 text-red-300"
                        : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {getEnumVariant(p.account.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
