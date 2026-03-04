"use client";

import { useState } from "react";
import { useLPProvider } from "@/hooks/useLPProvider";
import { useLPPosition } from "@/hooks/useLPPosition";
import { usePoolState } from "@/hooks/usePoolState";
import { TransactionToast } from "@/components/shared/TransactionToast";
import { solToLamports, bpsToPercent } from "@/lib/formatting";
import { SOL_PRICE_USD } from "@/lib/constants";

// ── Helpers ─────────────────────────────────────────────────────────────────
function num(bn: any): number {
  return typeof bn === "number" ? bn : bn.toNumber();
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function DepositPage() {
  const { depositUsdc, depositSol, loading, error, txSignature } =
    useLPProvider();
  const { data: position, exists, refresh: refreshPosition } = useLPPosition();
  const { data: pool, loading: poolLoading, refresh: refreshPool } = usePoolState();

  const [asset, setAsset] = useState<"usdc" | "sol">("usdc");
  const [amount, setAmount] = useState("");

  // ── Pool derived values ───────────────────────────────────────────────
  const usdcCapital = pool ? num(pool.totalCapitalUsdc) / 1e6 : 0;
  const solCapital = pool ? (num(pool.totalCapitalSol) / 1e9) * SOL_PRICE_USD : 0;
  const totalCapital = usdcCapital + solCapital;
  const deployedUsdc = pool ? num(pool.totalDeployedUsdc) / 1e6 : 0;
  const premiums = pool ? num(pool.totalPremiumsCollected) / 1e6 : 0;
  const claims = pool ? num(pool.totalClaimsPaid) / 1e6 : 0;
  const interest = pool ? num(pool.totalInterestEarned) / 1e6 : 0;
  const netRevenue = premiums + interest - claims;
  const scrBps = pool?.scrCoverageRatio ?? 10000;
  const scrPct = (scrBps / 100).toFixed(0);

  // Pool yield: annualized net revenue / total capital
  const poolYieldPct =
    totalCapital > 0 ? ((netRevenue / totalCapital) * 100).toFixed(2) : "0.00";

  // Allocation percentages
  const usdcIdlePct =
    totalCapital > 0 ? (((usdcCapital - deployedUsdc) / totalCapital) * 100).toFixed(0) : "0";
  const usdcDeployedPct =
    totalCapital > 0 ? ((deployedUsdc / totalCapital) * 100).toFixed(0) : "0";
  const solPct =
    totalCapital > 0 ? ((solCapital / totalCapital) * 100).toFixed(0) : "0";

  // SCR colour
  const scrColor =
    scrBps < 10000 ? "text-red-400" : scrBps < 20000 ? "text-amber-400" : "text-green-400";
  const scrBgColor =
    scrBps < 10000 ? "bg-red-500" : scrBps < 20000 ? "bg-amber-500" : "bg-green-500";

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleDeposit = async () => {
    if (!amount) return;

    try {
      if (asset === "usdc") {
        alert(
          "To deposit USDC, you need a funded USDC token account. This requires the USDC mint address for your network.",
        );
        return;
      } else {
        await depositSol(solToLamports(parseFloat(amount)));
      }
      setAmount("");
      await Promise.all([refreshPosition(), refreshPool()]);
    } catch {
      // error handled by hook
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold mb-6">Deposit</h2>

      {/* ── Pool Performance & Allocations ──────────────────────────────── */}
      {poolLoading ? (
        <div className="text-gray-500 mb-6">Loading pool data...</div>
      ) : pool ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 mb-6 space-y-4">
          {/* Hero stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                Total Capital
              </div>
              <div className="text-lg font-bold text-white">{fmtUsd(totalCapital)}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                Pool Yield
              </div>
              <div className="text-lg font-bold text-green-400">{poolYieldPct}%</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                SCR Coverage
              </div>
              <div className={`text-lg font-bold ${scrColor}`}>{scrPct}%</div>
            </div>
          </div>

          {/* Allocation bar */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
              Pool Allocation
            </div>
            <div className="h-3 w-full rounded-full overflow-hidden flex bg-gray-800">
              {totalCapital > 0 && (
                <>
                  <div
                    className="h-full"
                    style={{
                      width: `${usdcIdlePct}%`,
                      backgroundColor: "#6366f1",
                    }}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${usdcDeployedPct}%`,
                      backgroundColor: "#a78bfa",
                    }}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${solPct}%`,
                      backgroundColor: "#14b8a6",
                    }}
                  />
                </>
              )}
            </div>
            <div className="flex gap-4 mt-1.5 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "#6366f1" }} />
                USDC {usdcIdlePct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "#a78bfa" }} />
                Deployed {usdcDeployedPct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "#14b8a6" }} />
                SOL {solPct}%
              </span>
            </div>
          </div>

          {/* Performance row */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-800">
            <div className="text-center">
              <div className="text-[10px] text-gray-500">Premiums</div>
              <div className="text-sm font-semibold text-green-400">{fmtUsd(premiums)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500">Claims Paid</div>
              <div className="text-sm font-semibold text-red-400">{fmtUsd(claims)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500">Net Revenue</div>
              <div className={`text-sm font-semibold ${netRevenue >= 0 ? "text-green-400" : "text-red-400"}`}>
                {fmtUsd(netRevenue)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-gray-500 mb-6">Pool not initialized</div>
      )}

      {/* ── Deposit Form ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Asset – toggle buttons */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Asset</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAsset("sol")}
              className={`rounded px-4 py-2 text-sm font-medium transition-colors border ${
                asset === "sol"
                  ? "bg-brand-600 border-brand-500 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600"
              }`}
            >
              SOL
            </button>
            <button
              onClick={() => setAsset("usdc")}
              className={`rounded px-4 py-2 text-sm font-medium transition-colors border ${
                asset === "usdc"
                  ? "bg-brand-600 border-brand-500 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600"
              }`}
            >
              USDC
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Amount ({asset.toUpperCase()})
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={asset === "usdc" ? "10000" : "50"}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <button
          onClick={handleDeposit}
          disabled={loading || !amount}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          {loading ? "Depositing..." : `Deposit ${asset.toUpperCase()}`}
        </button>

        <p className="text-xs text-gray-500">
          First depositors receive LP tokens 1:1. Subsequent depositors receive
          tokens proportional to the pool value.
        </p>
      </div>

      <TransactionToast
        loading={loading}
        error={error}
        txSignature={txSignature}
      />
    </div>
  );
}
