"use client";

import { usePoolState } from "@/hooks/usePoolState";
import { useLPPosition } from "@/hooks/useLPPosition";
import { bpsToPercent } from "@/lib/formatting";
import { SOL_PRICE_USD } from "@/lib/constants";

// ── helpers ──────────────────────────────────────────────────────────
function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

// ── SVG donut chart ──────────────────────────────────────────────────
function DonutChart({
  segments,
  size = 180,
  strokeWidth = 28,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circumference;
          const currentOffset = offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-white text-sm font-semibold"
        >
          {fmtUsd(total)}
        </text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-gray-400">{seg.label}</span>
            <span className="font-medium">{fmtUsd(seg.value)}</span>
            <span className="text-gray-500">
              ({((seg.value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── horizontal bar ───────────────────────────────────────────────────
function HBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-medium">{fmtUsd(value)}</span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── SCR gauge ────────────────────────────────────────────────────────
function ScrGauge({ bps }: { bps: number }) {
  const pct = bps / 100;
  const barPct = Math.min((pct / 200) * 100, 100);
  const color =
    pct < 100 ? "#ef4444" : pct < 130 ? "#eab308" : "#22c55e";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Solvency Capital Ratio</span>
        <span className="font-medium" style={{ color }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${barPct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-600">
        <span>0%</span>
        <span>100%</span>
        <span>200%</span>
      </div>
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────
export default function LPDashboard() {
  const { data: pool, loading: poolLoading } = usePoolState();
  const { data: position, exists, loading: posLoading } = useLPPosition();

  if (poolLoading) return <div className="text-gray-500">Loading...</div>;

  // Data is already normalized to human-readable values
  const usdcCapital = pool?.totalCapitalUsdc ?? 0;
  const solCapital = pool ? pool.totalCapitalSol * SOL_PRICE_USD : 0;
  const deployedUsdc = pool?.totalDeployedUsdc ?? 0;
  const premiums = pool?.totalPremiumsCollected ?? 0;
  const claimsPaid = pool?.totalClaimsPaid ?? 0;
  const interest = pool?.totalInterestEarned ?? 0;
  const perfMax = Math.max(premiums, claimsPaid, interest, 1);

  // Position yield calc
  let apy = 0;
  let solDepUsd = 0;
  let usdcDep = 0;
  let totalDepUsd = 0;
  if (exists && position) {
    usdcDep = position.usdcDeposited;
    solDepUsd = position.solDeposited * SOL_PRICE_USD;
    totalDepUsd = usdcDep + solDepUsd;
    const rewards = position.rewardsEarned;
    const daysActive = Math.max((Date.now() / 1000 - position.depositedAt) / 86400, 1);
    if (totalDepUsd > 0) {
      apy = (rewards / totalDepUsd) * (365 / daysActive) * 100;
    }
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">LP Dashboard</h2>

      {/* Pool Overview */}
      {pool ? (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Pool Overview</h3>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="grid grid-cols-1 gap-4 min-w-[200px]">
              <div>
                <div className="text-sm text-gray-400">Total Capital</div>
                <div className="text-2xl font-bold">
                  {fmtUsd(usdcCapital + solCapital)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">LP Supply</div>
                <div className="text-xl font-semibold">
                  {pool.totalLpSupply.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">LP Fee</div>
                <div className="text-xl font-semibold">
                  {bpsToPercent(pool.lpFeeBps)}%
                </div>
              </div>
            </div>

            <DonutChart
              segments={[
                {
                  value: usdcCapital - deployedUsdc,
                  color: "#6366f1",
                  label: "USDC (idle)",
                },
                { value: deployedUsdc, color: "#a78bfa", label: "USDC (deployed)" },
                ...(solCapital > 0
                  ? [{ value: solCapital, color: "#14b8a6", label: "SOL" }]
                  : []),
              ]}
            />
          </div>
        </div>
      ) : (
        <div className="text-gray-500">Pool not initialized</div>
      )}

      {/* Pool Performance */}
      {pool && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Pool Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <HBar label="Premiums Collected" value={premiums} max={perfMax} color="#22c55e" />
              <HBar label="Claims Paid" value={claimsPaid} max={perfMax} color="#ef4444" />
              <HBar label="Interest Earned" value={interest} max={perfMax} color="#3b82f6" />

              <div className="pt-2 border-t border-gray-800 flex justify-between text-sm">
                <span className="text-gray-400">Net Revenue</span>
                <span className="font-semibold text-green-400">
                  {fmtUsd(premiums + interest - claimsPaid)}
                </span>
              </div>
            </div>

            <div>
              <ScrGauge bps={pool.scrCoverageRatio} />
            </div>
          </div>
        </div>
      )}

      {/* Your Position */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold mb-4">Your Position</h3>
        {posLoading ? (
          <div className="text-gray-500">Loading...</div>
        ) : !exists ? (
          <div className="text-gray-500">
            No LP position. Deposit {pool?.supportsNativeDeposit ? "USDC or SOL" : "USDC"} to get started.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="text-sm text-gray-400 mb-1">
                Annualized Yield (APY)
              </div>
              <div className="text-5xl font-bold text-green-400">
                {apy.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Based on {fmtUsd(position!.rewardsEarned)} earned on{" "}
                {fmtUsd(totalDepUsd)} over{" "}
                {Math.round(
                  (Date.now() / 1000 - position!.depositedAt) / 86400,
                )}{" "}
                days
              </div>
            </div>

            {/* Deposit composition bar */}
            {totalDepUsd > 0 && (
              <div className="space-y-1">
                <div className="text-sm text-gray-400">Deposit Composition</div>
                <div className="h-4 w-full rounded-full overflow-hidden flex">
                  <div
                    className="h-full"
                    style={{
                      width: `${(usdcDep / totalDepUsd) * 100}%`,
                      backgroundColor: "#6366f1",
                    }}
                  />
                  {solDepUsd > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(solDepUsd / totalDepUsd) * 100}%`,
                        backgroundColor: "#14b8a6",
                      }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>USDC {fmtUsd(usdcDep)} ({((usdcDep / totalDepUsd) * 100).toFixed(0)}%)</span>
                  {solDepUsd > 0 && (
                    <span>SOL {fmtUsd(solDepUsd)} ({((solDepUsd / totalDepUsd) * 100).toFixed(0)}%)</span>
                  )}
                </div>
              </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-400">LP Tokens</div>
                <div className="text-lg font-semibold">
                  {position!.lpTokens.toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-400">USDC Deposited</div>
                <div className="text-lg font-semibold">
                  {position!.usdcDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              {position!.solDeposited > 0 && (
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="text-xs text-gray-400">SOL Deposited</div>
                  <div className="text-lg font-semibold">
                    {position!.solDeposited.toFixed(4)}
                  </div>
                </div>
              )}
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-400">Rewards Earned</div>
                <div className="text-lg font-semibold text-green-400">
                  {position!.rewardsEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
