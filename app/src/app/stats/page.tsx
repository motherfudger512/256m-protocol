"use client";

import Link from "next/link";
import Image from "next/image";
import { WalletButton } from "@/components/wallet/WalletButton";
import { NetworkSwitcher } from "@/components/wallet/NetworkSwitcher";
import { useChain } from "@/chains/ChainContext";
import { usePoolState } from "@/hooks/usePoolState";
import { useProtocolState } from "@/hooks/useProtocolState";
import { useClaimsState } from "@/hooks/useClaimsState";
import { bpsToPercent } from "@/lib/formatting";
import { SOL_PRICE_USD } from "@/lib/constants";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

// ── SVG Donut Chart ─────────────────────────────────────────────────────────

function DonutChart({
  segments,
  size = 140,
  strokeWidth = 22,
  centerLabel,
  centerValue,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circumference;
          const currentOffset = offset;
          offset += dash;
          if (seg.value === 0) return null;
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
        {centerValue && (
          <>
            <text
              x={size / 2}
              y={size / 2 - 8}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white text-base font-bold"
            >
              {centerValue}
            </text>
            {centerLabel && (
              <text
                x={size / 2}
                y={size / 2 + 10}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-gray-400"
                style={{ fontSize: "10px" }}
              >
                {centerLabel}
              </text>
            )}
          </>
        )}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments.map((seg, i) =>
          seg.value > 0 ? (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-gray-400">{seg.label}</span>
              <span className="text-gray-500">
                ({((seg.value / total) * 100).toFixed(0)}%)
              </span>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

// ── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({
  label,
  value,
  max,
  color,
  displayValue,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  displayValue: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-medium text-white">{displayValue}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── SCR Gauge ───────────────────────────────────────────────────────────────

function ScrGauge({ bps }: { bps: number }) {
  const pct = bps / 100;
  const barPct = Math.min((pct / 300) * 100, 100);
  const color = pct < 100 ? "#ef4444" : pct < 200 ? "#eab308" : "#22c55e";
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-gray-400">Solvency Capital Ratio</span>
        <span className="text-2xl font-bold" style={{ color }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${barPct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>0%</span>
        <span>100%</span>
        <span>200%</span>
        <span>300%</span>
      </div>
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  subtext,
}: {
  label: string;
  value: string;
  color?: string;
  subtext?: string;
}) {
  return (
    <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold ${color ?? "text-white"}`}>{value}</div>
      {subtext && <div className="text-[10px] text-gray-600 mt-0.5">{subtext}</div>}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { adapter } = useChain();
  const { data: pool, loading: poolLoading } = usePoolState();
  const { data: protocol, loading: protocolLoading } = useProtocolState();
  const { data: claims, loading: claimsLoading } = useClaimsState();

  const loading = poolLoading || protocolLoading || claimsLoading;

  // Pool values are already normalized to human-readable numbers
  const usdcCapital = pool?.totalCapitalUsdc ?? 0;
  const solCapital = pool ? pool.totalCapitalSol * SOL_PRICE_USD : 0;
  const totalCapital = usdcCapital + solCapital;
  const deployedUsdc = pool?.totalDeployedUsdc ?? 0;
  const premiums = pool?.totalPremiumsCollected ?? 0;
  const claimsPaid = pool?.totalClaimsPaid ?? 0;
  const interest = pool?.totalInterestEarned ?? 0;
  const netRevenue = premiums + interest - claimsPaid;
  const lossRatio = premiums > 0 ? (claimsPaid / premiums) * 100 : 0;

  const totalPolicies = protocol?.totalPolicies ?? 0;
  const activePolicies = protocol?.activePolicies ?? 0;
  const maxPolicies = protocol?.maxPolicies ?? 1;

  const totalClaims = claims?.totalClaims ?? 0;
  const approved = claims?.approvedClaims ?? 0;
  const rejected = claims?.rejectedClaims ?? 0;
  const pending = totalClaims - approved - rejected;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <Image src="/logo.svg" alt="256M" width={120} height={25} />
        </Link>
        <div className="flex items-center gap-3">
          <NetworkSwitcher />
          <WalletButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-8 space-y-8">
        <div>
          <h2 className="text-3xl font-bold mb-1">Protocol Statistics</h2>
          <p className="text-sm text-gray-500">
            Real-time on-chain data across all 256M smart contracts
          </p>
        </div>

        {loading ? (
          <div className="text-gray-500">Loading on-chain data...</div>
        ) : (
          <>
            {/* ── Hero Metrics ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Value Locked"
                value={fmtUsd(totalCapital)}
                subtext="USDC + SOL at market"
              />
              <StatCard
                label="Active Policies"
                value={fmtNumber(activePolicies)}
                color="text-brand-400"
                subtext={`of ${fmtNumber(totalPolicies)} total`}
              />
              <StatCard
                label="Claims Processed"
                value={fmtNumber(totalClaims)}
                subtext={`${approved} approved, ${rejected} rejected`}
              />
              <StatCard
                label="Net Revenue"
                value={fmtUsd(netRevenue)}
                color={netRevenue >= 0 ? "text-green-400" : "text-red-400"}
                subtext="Premiums + Interest - Claims"
              />
            </div>

            {/* ── Pool Allocation & Claims Split ────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pool allocation donut */}
              {pool && (
                <div className="bg-gray-900/60 rounded-xl p-6 border border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Pool Allocation
                  </h3>
                  <div className="flex justify-center">
                    <DonutChart
                      centerValue={fmtUsd(totalCapital)}
                      centerLabel="TVL"
                      segments={[
                        {
                          value: usdcCapital - deployedUsdc,
                          color: "#6366f1",
                          label: "USDC (idle)",
                        },
                        {
                          value: deployedUsdc,
                          color: "#a78bfa",
                          label: "Deployed",
                        },
                        {
                          value: solCapital,
                          color: "#14b8a6",
                          label: "SOL",
                        },
                      ]}
                    />
                  </div>
                </div>
              )}

              {/* Claims split donut */}
              {claims && (
                <div className="bg-gray-900/60 rounded-xl p-6 border border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Claims Breakdown
                  </h3>
                  <div className="flex justify-center">
                    <DonutChart
                      centerValue={String(totalClaims)}
                      centerLabel="Total"
                      segments={[
                        { value: approved, color: "#22c55e", label: "Approved" },
                        { value: rejected, color: "#ef4444", label: "Rejected" },
                        { value: pending, color: "#eab308", label: "Pending" },
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Financial Performance ─────────────────────────────────── */}
            {pool && (
              <div className="bg-gray-900/60 rounded-xl p-6 border border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
                  Financial Performance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <ProgressBar
                      label="Premiums Collected"
                      value={premiums}
                      max={premiums}
                      color="#22c55e"
                      displayValue={fmtUsd(premiums)}
                    />
                    <ProgressBar
                      label="Claims Paid"
                      value={claimsPaid}
                      max={premiums}
                      color="#ef4444"
                      displayValue={fmtUsd(claimsPaid)}
                    />
                    <ProgressBar
                      label="Interest Earned"
                      value={interest}
                      max={premiums}
                      color="#3b82f6"
                      displayValue={fmtUsd(interest)}
                    />
                    <div className="pt-3 border-t border-gray-800 flex justify-between text-sm">
                      <span className="text-gray-400">Loss Ratio</span>
                      <span
                        className={`font-bold ${
                          lossRatio < 60
                            ? "text-green-400"
                            : lossRatio < 80
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {lossRatio.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* SCR gauge */}
                  <div className="space-y-6">
                    <ScrGauge bps={pool.scrCoverageRatio} />

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                        <div className="text-[10px] text-gray-500 uppercase">LP Supply</div>
                        <div className="text-sm font-semibold">
                          {fmtNumber(pool.totalLpSupply)}
                        </div>
                      </div>
                      <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                        <div className="text-[10px] text-gray-500 uppercase">LP Fee</div>
                        <div className="text-sm font-semibold">
                          {bpsToPercent(pool.lpFeeBps)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Policy Utilization ────────────────────────────────────── */}
            {protocol && (
              <div className="bg-gray-900/60 rounded-xl p-6 border border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
                  Policy Utilization
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <ProgressBar
                      label="Active Policies"
                      value={activePolicies}
                      max={totalPolicies}
                      color="#6366f1"
                      displayValue={`${fmtNumber(activePolicies)} / ${fmtNumber(totalPolicies)}`}
                    />
                    <ProgressBar
                      label="Capacity Used"
                      value={totalPolicies}
                      max={maxPolicies}
                      color={totalPolicies / maxPolicies > 0.8 ? "#ef4444" : "#14b8a6"}
                      displayValue={`${((totalPolicies / maxPolicies) * 100).toFixed(1)}%`}
                    />
                    <div className="pt-3 border-t border-gray-800 flex justify-between text-sm">
                      <span className="text-gray-400">Premiums Collected</span>
                      <span className="font-bold text-green-400">{fmtUsd(premiums)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                      <div className="text-[10px] text-gray-500 uppercase">Platform Fee</div>
                      <div className="text-sm font-semibold">
                        {bpsToPercent(protocol.platformFeeBps)}%
                      </div>
                    </div>
                    <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                      <div className="text-[10px] text-gray-500 uppercase">Max Insured</div>
                      <div className="text-sm font-semibold">
                        {fmtUsd(protocol.maxInsuredValue)}
                      </div>
                    </div>
                    <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                      <div className="text-[10px] text-gray-500 uppercase">Max Policies</div>
                      <div className="text-sm font-semibold">
                        {fmtNumber(maxPolicies)}
                      </div>
                    </div>
                    <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                      <div className="text-[10px] text-gray-500 uppercase">Total Paid Out</div>
                      <div className="text-sm font-semibold text-red-400">
                        {fmtUsd(claimsPaid)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Claims Operations ────────────────────────────────────── */}
            {claims && (
              <div className="bg-gray-900/60 rounded-xl p-6 border border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
                  Claims Operations
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">{totalClaims}</div>
                    <div className="text-xs text-gray-500 mt-1">Total Filed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400">{approved}</div>
                    <div className="text-xs text-gray-500 mt-1">Approved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-400">{rejected}</div>
                    <div className="text-xs text-gray-500 mt-1">Rejected</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-400">{pending}</div>
                    <div className="text-xs text-gray-500 mt-1">Pending</div>
                  </div>
                </div>

                {/* Approval rate bar */}
                {totalClaims > 0 && (
                  <div className="mt-5 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Approval Rate</span>
                      <span className="font-medium text-white">
                        {((approved / totalClaims) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full overflow-hidden flex bg-gray-800">
                      <div
                        className="h-full"
                        style={{
                          width: `${(approved / totalClaims) * 100}%`,
                          backgroundColor: "#22c55e",
                        }}
                      />
                      <div
                        className="h-full"
                        style={{
                          width: `${(rejected / totalClaims) * 100}%`,
                          backgroundColor: "#ef4444",
                        }}
                      />
                      <div
                        className="h-full"
                        style={{
                          width: `${(pending / totalClaims) * 100}%`,
                          backgroundColor: "#eab308",
                        }}
                      />
                    </div>
                    <div className="flex gap-4 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-green-500" />
                        Approved
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-red-500" />
                        Rejected
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-amber-500" />
                        Pending
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-gray-800">
                  <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                    <div className="text-[10px] text-gray-500 uppercase">Max Auto Payout</div>
                    <div className="text-sm font-semibold">
                      {fmtUsd(claims.maxAutoPayout)}
                    </div>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                    <div className="text-[10px] text-gray-500 uppercase">Daily Auto Limit</div>
                    <div className="text-sm font-semibold">
                      {fmtUsd(claims.dailyAutoPayoutLimit)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
