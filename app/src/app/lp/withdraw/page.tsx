"use client";

import { useState, useMemo } from "react";
import { useLPProvider } from "@/hooks/useLPProvider";
import { useLPPosition } from "@/hooks/useLPPosition";
import { usePoolState } from "@/hooks/usePoolState";
import { TransactionToast } from "@/components/shared/TransactionToast";
import BN from "bn.js";

// ── Withdrawal fee tiers ────────────────────────────────────────────────────
// Max fee cap is 10%. If the on-chain fee would exceed 10%, withdrawals are
// temporarily suspended to protect pool solvency.
const MAX_FEE_BPS = 1000; // 10%

function getWithdrawalFeeBps(coverageRatio: number): number {
  if (coverageRatio <= 9000) return -1;    // suspended (would exceed 10%)
  if (coverageRatio <= 11000) return 1000; // 10%
  if (coverageRatio <= 13000) return 500;  // 5%
  if (coverageRatio <= 15000) return 100;  // 1%
  return 0;                                // 0%
}

// Fee tier labels for the graphic
const FEE_TIERS = [
  { label: "< 90%", feePct: "Suspended", minBps: 0, maxBps: 9000, suspended: true },
  { label: "90–110%", feePct: "10%", minBps: 9001, maxBps: 11000, suspended: false },
  { label: "110–130%", feePct: "5%", minBps: 11001, maxBps: 13000, suspended: false },
  { label: "130–150%", feePct: "1%", minBps: 13001, maxBps: 15000, suspended: false },
  { label: "150%+", feePct: "0%", minBps: 15001, maxBps: 99999, suspended: false },
];

export default function WithdrawPage() {
  const { withdrawUsdc, withdrawSol, loading, error, txSignature } =
    useLPProvider();
  const { data: position, exists, refresh: refreshPosition } = useLPPosition();
  const { data: poolState, refresh: refreshPool } = usePoolState();

  const [asset, setAsset] = useState<"usdc" | "sol">("usdc");
  const [lpTokens, setLpTokens] = useState("");

  // Current SCR coverage ratio from on-chain pool state (in bps, e.g. 15000 = 150%)
  const scrCoverageRatio = poolState?.scrCoverageRatio ?? 10000;
  const scrPct = (scrCoverageRatio / 100).toFixed(0);

  // Current withdrawal fee
  const currentFeeBps = useMemo(
    () => getWithdrawalFeeBps(scrCoverageRatio),
    [scrCoverageRatio],
  );
  const withdrawalsSuspended = currentFeeBps < 0;
  const currentFeePct = withdrawalsSuspended ? "0" : (currentFeeBps / 100).toFixed(1);

  // SCR colour coding
  const scrColor =
    scrCoverageRatio < 10000
      ? "text-red-400"
      : scrCoverageRatio < 20000
        ? "text-amber-400"
        : "text-green-400";

  const scrBgColor =
    scrCoverageRatio < 10000
      ? "bg-red-500"
      : scrCoverageRatio < 20000
        ? "bg-amber-500"
        : "bg-green-500";

  const scrBorderColor =
    scrCoverageRatio < 10000
      ? "border-red-500/30"
      : scrCoverageRatio < 20000
        ? "border-amber-500/30"
        : "border-green-500/30";

  // LP token balance for percentage buttons
  const userLpTokens = position?.lpTokens?.toNumber() ?? 0;

  const handlePercentage = (pct: number) => {
    if (pct >= 100) {
      setLpTokens(String(userLpTokens));
    } else {
      setLpTokens(String(Math.floor((userLpTokens * pct) / 100)));
    }
  };

  const handleWithdraw = async () => {
    if (!lpTokens) return;
    const amount = new BN(lpTokens);

    try {
      if (asset === "usdc") {
        alert(
          "To withdraw USDC, you need a USDC token account. This requires the USDC mint address for your network.",
        );
        return;
      } else {
        await withdrawSol(amount);
      }
      setLpTokens("");
      await Promise.all([refreshPosition(), refreshPool()]);
    } catch {
      // error handled by hook
    }
  };

  if (!exists) {
    return (
      <div className="max-w-lg">
        <h2 className="text-2xl font-bold mb-4">No Position</h2>
        <p className="text-gray-400">
          You don&apos;t have an LP position. Deposit first to receive LP tokens.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold mb-6">Withdraw</h2>

      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 mb-6">
        <div className="text-sm text-gray-400">Your LP Tokens</div>
        <div className="text-2xl font-bold">
          {userLpTokens.toLocaleString()}
        </div>
      </div>

      <div className="space-y-4">
        {/* LP Tokens to Burn */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            LP Tokens to Burn
          </label>
          <input
            type="number"
            value={lpTokens}
            onChange={(e) => setLpTokens(e.target.value)}
            placeholder="Enter LP token amount"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />

          {/* Quick percentage buttons */}
          <div className="flex gap-2 mt-2">
            {[25, 50].map((pct) => (
              <button
                key={pct}
                onClick={() => handlePercentage(pct)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors"
              >
                {pct}%
              </button>
            ))}
            <button
              onClick={() => handlePercentage(100)}
              className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors"
            >
              Max
            </button>
          </div>
        </div>

        {/* Withdraw As – toggle buttons */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Withdraw As
          </label>
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

        <button
          onClick={handleWithdraw}
          disabled={loading || !lpTokens || withdrawalsSuspended}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          {loading
            ? "Withdrawing..."
            : withdrawalsSuspended
              ? "Withdrawals Temporarily Suspended"
              : `Withdraw ${asset.toUpperCase()}`}
        </button>

        {withdrawalsSuspended && (
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3">
            <p className="text-sm text-red-400 font-medium">Withdrawals are temporarily suspended</p>
            <p className="text-xs text-red-400/70 mt-1">
              The pool&apos;s SCR coverage ratio is below 90%. Withdrawals will resume
              once the ratio recovers above this threshold.
            </p>
          </div>
        )}

        {/* ── SCR Coverage Ratio & Withdrawal Fee Graphic ────────────────── */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 mt-2 space-y-4">
          {/* Top row: fee + SCR side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Current Withdrawal Fee */}
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Withdrawal Fee
              </div>
              <div className={`text-2xl font-bold ${withdrawalsSuspended ? "text-red-400" : "text-white"}`}>
                {withdrawalsSuspended ? "Suspended" : currentFeeBps === 0 ? "0%" : `${currentFeePct}%`}
              </div>
            </div>

            {/* Current SCR Coverage Ratio */}
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                SCR Coverage
              </div>
              <div className={`text-2xl font-bold ${scrColor}`}>
                {scrPct}%
              </div>
            </div>
          </div>

          {/* SCR coverage bar */}
          <div>
            <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${scrBgColor}`}
                style={{ width: `${Math.min(100, scrCoverageRatio / 300)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>0%</span>
              <span>100%</span>
              <span>200%</span>
              <span>300%</span>
            </div>
          </div>

          {/* Fee tier table */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Fee Schedule
            </div>
            <div className="space-y-1">
              {FEE_TIERS.map((tier) => {
                const isActive =
                  scrCoverageRatio >= tier.minBps &&
                  scrCoverageRatio <= tier.maxBps;
                return (
                  <div
                    key={tier.label}
                    className={`flex items-center justify-between rounded px-2.5 py-1.5 text-xs transition-colors ${
                      isActive
                        ? tier.suspended
                          ? "border border-red-500/30 bg-red-950/20 text-red-400"
                          : `${scrBorderColor} border bg-gray-800/80 text-white`
                        : "text-gray-500"
                    }`}
                  >
                    <span>
                      SCR {tier.label}
                    </span>
                    <span className={`font-mono ${isActive ? "font-semibold" : ""}`}>
                      {tier.feePct}{tier.suspended ? "" : " fee"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <TransactionToast
        loading={loading}
        error={error}
        txSignature={txSignature}
      />
    </div>
  );
}
