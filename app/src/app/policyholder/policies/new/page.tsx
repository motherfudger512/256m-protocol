"use client";

import { useState, useMemo, useRef } from "react";
import { usePolicyholder } from "@/hooks/usePolicyholder";
import { useCustomer } from "@/hooks/useCustomer";
import { usePoolState } from "@/hooks/usePoolState";
import { TransactionToast } from "@/components/shared/TransactionToast";
import { usdcToBase } from "@/lib/formatting";
import {
  calculateQuote,
  riskScoreToLevel,
  RISK_LEVEL_MAX,
  MAX_INSURED_VALUE,
  BRAND_TIER_OPTIONS,
  COUNTRY_OPTIONS,
  STORAGE_OPTIONS,
  WEAR_OPTIONS,
  AGE_OPTIONS,
  URBAN_OPTIONS,
  RECOGNIZABILITY_OPTIONS,
  POSTCODE_OPTIONS,
  CLAIMS_HISTORY_OPTIONS,
  GPS_OPTIONS,
  PURCHASE_RECENCY_OPTIONS,
  type BrandTier,
  type Country,
  type StorageSecurity,
  type WearFrequency,
  type AgeGroup,
  type UrbanDensity,
  type Recognizability,
  type PostcodeRisk,
  type ClaimsHistory,
  type GPSTracking,
  type PurchaseRecency,
  type QuoteBreakdown,
} from "@/lib/pricing";

// ── Step definitions ────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Watch" },
  { id: 2, label: "Profile" },
  { id: 3, label: "Coverage" },
  { id: 4, label: "Quote" },
] as const;

// ── Shared form components ──────────────────────────────────────────────────

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; examples?: string }[];
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.examples ? ` (${o.examples})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">
      {children}
    </h4>
  );
}

// ── Main page component ─────────────────────────────────────────────────────

export default function GetQuotePage() {
  const { createPolicy, loading, error, txSignature } = usePolicyholder();
  const { data: customer, exists } = useCustomer();
  const { data: poolState } = usePoolState();

  // SCR check: block new policies when pool is undercapitalised (< 100%)
  const scrCoverageRatio = poolState?.scrCoverageRatio ?? 10000;
  const poolUndercapitalised = scrCoverageRatio < 10000;

  // Step state
  const [step, setStep] = useState(1);

  // Watch inputs
  const [watchDescription, setWatchDescription] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [watchValue, setWatchValue] = useState("");
  const [brandTier, setBrandTier] = useState<BrandTier>("high_luxury");
  const [recognizability, setRecognizability] = useState<Recognizability>("well_known");

  // Proof of purchase upload
  const [proofFileName, setProofFileName] = useState("");
  const [proofFileError, setProofFileError] = useState("");
  const proofFileRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setProofFileError("");
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setProofFileError("Only PDF, PNG, and JPG files are accepted.");
      setProofFileName("");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setProofFileError(`File exceeds the 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB).`);
      setProofFileName("");
      e.target.value = "";
      return;
    }

    setProofFileName(file.name);
  };

  // Profile inputs
  const [country, setCountry] = useState<Country>("uk");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("26_34");
  const [urbanDensity, setUrbanDensity] = useState<UrbanDensity>("city");
  const [postcodeRisk, setPostcodeRisk] = useState<PostcodeRisk>("moderate");
  const [claimsHistory, setClaimsHistory] = useState<ClaimsHistory>("none");
  const [storageSecurity, setStorageSecurity] = useState<StorageSecurity>("standard");
  const [wearFrequency, setWearFrequency] = useState<WearFrequency>("weekly");
  const [gpsTracking, setGpsTracking] = useState<GPSTracking>("none");
  const [purchaseRecency, setPurchaseRecency] = useState<PurchaseRecency>("over_180");

  // Coverage inputs
  const [coverageType, setCoverageType] = useState<"theftOnly" | "theftAndLoss">("theftAndLoss");
  const [paymentFrequency, setPaymentFrequency] = useState<"monthly" | "annual">("annual");
  const [durationDays, setDurationDays] = useState("365");

  // Computed quote
  const quote: QuoteBreakdown | null = useMemo(() => {
    const val = parseFloat(watchValue);
    if (!val || val <= 0) return null;
    return calculateQuote({
      watchValue: val,
      brandTier,
      country,
      storageSecurity,
      wearFrequency,
      ageGroup,
      urbanDensity,
      recognizability,
      postcodeRisk,
      claimsHistory,
      gpsTracking,
      purchaseRecency,
      coverageType,
      paymentFrequency,
      durationDays: parseInt(durationDays) || 365,
    });
  }, [
    watchValue, brandTier, country, storageSecurity, wearFrequency,
    ageGroup, urbanDensity, recognizability, postcodeRisk, claimsHistory,
    gpsTracking, purchaseRecency, coverageType, paymentFrequency, durationDays,
  ]);

  // Policy created state
  const [policyCreated, setPolicyCreated] = useState(false);

  // ── Guards ──────────────────────────────────────────────────────────────

  if (!exists) {
    return (
      <div className="max-w-lg">
        <h2 className="text-2xl font-bold mb-4">Register First</h2>
        <p className="text-gray-400">
          You must register as a customer before getting a quote.
        </p>
      </div>
    );
  }

  if (!customer?.kycVerified) {
    return (
      <div className="max-w-lg">
        <h2 className="text-2xl font-bold mb-4">KYC Pending</h2>
        <p className="text-gray-400">
          Your KYC verification is still pending. An admin must verify your
          identity before you can get a quote.
        </p>
      </div>
    );
  }

  // ── Accept quote → create policy on-chain ─────────────────────────────

  const handleAcceptQuote = async () => {
    if (!quote) return;
    try {
      const hashInput = `${watchDescription}|${serialNumber}`;
      const hashBytes = Array.from(
        Buffer.from(hashInput.padEnd(32, "\0").slice(0, 32), "utf-8"),
      );

      await createPolicy({
        watchDetailsHash: hashBytes,
        insuredValue: usdcToBase(parseFloat(watchValue)),
        premium: usdcToBase(quote.premiumUsdc),
        deductibleBps: quote.deductibleBps,
        coverageType: coverageType === "theftOnly" ? { theftOnly: {} } : { theftAndLoss: {} },
        paymentFrequency: paymentFrequency === "monthly" ? { monthly: {} } : { annual: {} },
        durationDays: parseInt(durationDays),
      });
      setPolicyCreated(true);
    } catch {
      // error handled by hook
    }
  };

  // ── Step navigation helpers ───────────────────────────────────────────

  const parsedValue = parseFloat(watchValue) || 0;
  const exceedsMaxValue = parsedValue > MAX_INSURED_VALUE;
  const canAdvanceStep1 =
    watchDescription.trim() !== "" &&
    serialNumber.trim() !== "" &&
    proofFileName !== "" &&
    parsedValue > 0 &&
    !exceedsMaxValue;
  const canAdvanceStep2 = true; // all profile fields have defaults
  const canAdvanceStep3 = parseInt(durationDays) >= 30;

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <h2 className="text-2xl font-bold mb-1">Get a Quote</h2>
      <p className="text-gray-500 text-sm mb-6">
        Answer a few questions and we'll calculate your premium using our actuarial model.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1">
            <button
              onClick={() => {
                if (s.id < step) setStep(s.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                step === s.id
                  ? "bg-brand-600 text-white"
                  : step > s.id
                    ? "bg-brand-900/40 text-brand-400 cursor-pointer hover:bg-brand-900/60"
                    : "bg-gray-800 text-gray-500"
              }`}
            >
              <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]">
                {step > s.id ? "\u2713" : s.id}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px ${step > s.id ? "bg-brand-600" : "bg-gray-700"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Watch Details ──────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <SectionLabel>Watch Information</SectionLabel>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Watch Description</label>
            <input
              type="text"
              value={watchDescription}
              onChange={(e) => setWatchDescription(e.target.value)}
              placeholder="e.g. Rolex Submariner Ref. 126610LN"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Serial Number</label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="e.g. 7R4X9021"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <p className="text-xs text-gray-600 mt-1">
              Found on the caseback or between the lugs of your watch
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Watch Value (USDC)</label>
            <input
              type="number"
              value={watchValue}
              onChange={(e) => setWatchValue(e.target.value)}
              placeholder="12000"
              min="0"
              className={`w-full bg-gray-900 border rounded px-3 py-2 text-sm focus:outline-none ${
                exceedsMaxValue ? "border-red-500 focus:border-red-500" : "border-gray-700 focus:border-brand-500"
              }`}
            />
            {exceedsMaxValue && (
              <p className="text-red-400 text-xs mt-1.5">
                Currently we are unable to insure individual items exceeding a value of {MAX_INSURED_VALUE.toLocaleString()} USD.
              </p>
            )}
          </div>

          <SelectField
            label="Brand Tier"
            value={brandTier}
            onChange={setBrandTier}
            options={BRAND_TIER_OPTIONS}
          />

          <SelectField
            label="Model Recognisability"
            value={recognizability}
            onChange={setRecognizability}
            options={RECOGNIZABILITY_OPTIONS}
          />

          {/* Proof of purchase upload */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Proof of Purchase
            </label>
            <div
              onClick={() => proofFileRef.current?.click()}
              className="w-full bg-gray-900 border border-dashed border-gray-700 rounded px-4 py-5 text-center cursor-pointer hover:border-brand-500 transition-colors"
            >
              <input
                ref={proofFileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleProofFileChange}
                className="hidden"
              />
              {proofFileName ? (
                <div>
                  <span className="text-sm text-brand-400 font-medium">{proofFileName}</span>
                  <p className="text-xs text-gray-500 mt-1">Click to change file</p>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-gray-400">
                    Click to upload proof of purchase
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Receipt, invoice, or certificate of authenticity &middot; PDF, PNG, or JPG &middot; Max 10MB
                  </p>
                </div>
              )}
            </div>
            {proofFileError && (
              <p className="text-red-400 text-xs mt-1.5">{proofFileError}</p>
            )}
          </div>

          {/* Live mini-preview */}
          {quote && (
            <div className="mt-4 p-3 rounded-lg border border-gray-800 bg-gray-900/50">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-500">Estimated annual premium</span>
                <span className="text-lg font-semibold text-brand-400">
                  {quote.grossPremiumAnnual.toFixed(2)} USDC
                </span>
              </div>
              <div className="text-xs text-gray-600 text-right">
                {quote.ratePercent.toFixed(2)}% of insured value
              </div>
            </div>
          )}

          <button
            onClick={next}
            disabled={!canAdvanceStep1}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium transition-colors"
          >
            Continue
          </button>
        </div>
      )}

      {/* ── Step 2: Risk Profile ───────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <SectionLabel>Location</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Country" value={country} onChange={setCountry} options={COUNTRY_OPTIONS} />
            <SelectField label="Urban Density" value={urbanDensity} onChange={setUrbanDensity} options={URBAN_OPTIONS} />
          </div>
          <SelectField label="Postcode Risk Level" value={postcodeRisk} onChange={setPostcodeRisk} options={POSTCODE_OPTIONS} />

          <SectionLabel>Security & Usage</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Storage Security" value={storageSecurity} onChange={setStorageSecurity} options={STORAGE_OPTIONS} />
            <SelectField label="Wear Frequency" value={wearFrequency} onChange={setWearFrequency} options={WEAR_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="GPS / AirTag Tracking" value={gpsTracking} onChange={setGpsTracking} options={GPS_OPTIONS} />
            <SelectField label="Purchase Recency" value={purchaseRecency} onChange={setPurchaseRecency} options={PURCHASE_RECENCY_OPTIONS} />
          </div>

          <SectionLabel>Personal</SectionLabel>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Age Group" value={ageGroup} onChange={setAgeGroup} options={AGE_OPTIONS} />
            <SelectField label="Claims History" value={claimsHistory} onChange={setClaimsHistory} options={CLAIMS_HISTORY_OPTIONS} />
          </div>

          {/* Live mini-preview */}
          {quote && (
            <div className="p-3 rounded-lg border border-gray-800 bg-gray-900/50">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-500">Risk score</span>
                <span className="text-sm font-semibold text-white">
                  {riskScoreToLevel(quote.enhancedRiskScore)} / {RISK_LEVEL_MAX}
                </span>
              </div>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-xs text-gray-500">Estimated annual premium</span>
                <span className="text-lg font-semibold text-brand-400">
                  {quote.grossPremiumAnnual.toFixed(2)} USDC
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={back}
              className="flex-1 border border-gray-700 hover:border-gray-600 rounded px-4 py-2 text-sm font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={next}
              disabled={!canAdvanceStep2}
              className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Coverage Options ───────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <SectionLabel>Coverage</SectionLabel>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Coverage Type</label>
              <select
                value={coverageType}
                onChange={(e) => setCoverageType(e.target.value as any)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option value="theftAndLoss">Theft & Loss</option>
                <option value="theftOnly">Theft Only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Payment Frequency</label>
              <select
                value={paymentFrequency}
                onChange={(e) => setPaymentFrequency(e.target.value as any)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Policy Duration (days)</label>
            <input
              type="number"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              min="30"
              max="365"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <span className="text-xs text-gray-500">30 – 365 days</span>
          </div>

          {/* Compare coverage */}
          {quote && (
            <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/50 space-y-2">
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">
                Premium Preview
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Annual Premium</span>
                <span className="text-sm font-semibold">{quote.grossPremiumAnnual.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Monthly Premium</span>
                <span className="text-sm font-semibold">{quote.grossPremiumMonthly.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Rate</span>
                <span className="text-sm">{quote.ratePercent.toFixed(2)}% of insured value</span>
              </div>
              {coverageType === "theftAndLoss" && (
                <div className="text-xs text-gray-600 mt-1">
                  Theft: 100% payout &middot; Loss: 80% payout (20% deductible)
                </div>
              )}
              {coverageType === "theftOnly" && (
                <div className="text-xs text-gray-600 mt-1">
                  Theft: 100% payout &middot; 0% deductible
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={back}
              className="flex-1 border border-gray-700 hover:border-gray-600 rounded px-4 py-2 text-sm font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={next}
              disabled={!canAdvanceStep3}
              className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium transition-colors"
            >
              View Quote
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Quote Summary ──────────────────────────────────────── */}
      {step === 4 && quote && !policyCreated && (
        <div className="space-y-5">
          {/* Hero premium */}
          <div className="text-center p-6 rounded-xl border border-brand-500/30 bg-brand-950/20">
            <div className="text-sm text-gray-400 mb-1">Your Premium</div>
            <div className="text-4xl font-bold text-brand-400">
              {quote.premiumAmount.toFixed(2)} <span className="text-lg font-normal text-gray-400">USDC</span>
            </div>
            <div className="text-sm text-gray-500 mt-1">{quote.premiumLabel}</div>
          </div>

          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-500">Insured Value</div>
              <div className="text-sm font-semibold">{parseFloat(watchValue).toLocaleString()} USDC</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-500">Annual Rate</div>
              <div className="text-sm font-semibold">{quote.ratePercent.toFixed(2)}%</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-500">Risk Score</div>
              <div className="text-sm font-semibold">{riskScoreToLevel(quote.enhancedRiskScore)} / {RISK_LEVEL_MAX}</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-500">Coverage</div>
              <div className="text-sm font-semibold">
                {coverageType === "theftAndLoss" ? "Theft & Loss" : "Theft Only"}
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-500">Duration</div>
              <div className="text-sm font-semibold">{durationDays} days</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-500">Watch</div>
              <div className="text-sm font-semibold truncate">{watchDescription}</div>
            </div>
          </div>

          {/* Annual premium summary */}
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 bg-gray-900">
              <span className="text-sm font-semibold text-gray-300">Annual Premium</span>
              <span className="text-lg font-bold text-brand-400">{quote.grossPremiumAnnual.toFixed(2)} USDC</span>
            </div>
          </div>

          {/* Risk score scale */}
          {(() => {
            const level = riskScoreToLevel(quote.enhancedRiskScore);
            return (
              <div className="rounded-lg border border-gray-800 overflow-hidden p-4 bg-gray-900/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Risk Score
                  </span>
                  <span className="text-2xl font-bold" style={{
                    color: level <= 3 ? "#4ade80" : level <= 6 ? "#facc15" : "#f87171",
                  }}>
                    {level}
                  </span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: RISK_LEVEL_MAX + 1 }, (_, i) => {
                    const bg =
                      i <= 3 ? (i <= level ? "bg-green-500" : "bg-green-500/20")
                      : i <= 6 ? (i <= level ? "bg-yellow-400" : "bg-yellow-400/20")
                      : (i <= level ? "bg-red-500" : "bg-red-500/20");
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full h-3 rounded-sm ${bg} transition-colors`} />
                        <span className={`text-[10px] ${i === level ? "text-white font-bold" : "text-gray-600"}`}>
                          {i}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-green-500/70">Low Risk</span>
                  <span className="text-[10px] text-red-500/70">High Risk</span>
                </div>
              </div>
            );
          })()}

          {/* Pool undercapitalised warning */}
          {poolUndercapitalised && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3">
              <p className="text-sm text-red-400 font-medium">New policies are temporarily unavailable</p>
              <p className="text-xs text-red-400/70 mt-1">
                The liquidity pool&apos;s solvency capital ratio is currently below 100%.
                New policies cannot be created until the pool is adequately capitalised.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={back}
              className="flex-1 border border-gray-700 hover:border-gray-600 rounded px-4 py-2 text-sm font-medium transition-colors"
            >
              Adjust Quote
            </button>
            <button
              onClick={handleAcceptQuote}
              disabled={loading || poolUndercapitalised}
              className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium transition-colors"
            >
              {loading
                ? "Creating Policy..."
                : poolUndercapitalised
                  ? "Unavailable"
                  : "Accept & Create Policy"}
            </button>
          </div>
        </div>
      )}

      {/* ── Policy Created Success ─────────────────────────────────────── */}
      {policyCreated && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">&#10003;</div>
          <h3 className="text-xl font-bold mb-2">Policy Created</h3>
          <p className="text-gray-400 text-sm mb-4">
            Your watch insurance policy has been created on-chain.
            Head to your policies page to view it and pay your first premium.
          </p>
          <a
            href="/policyholder/policies"
            className="inline-block bg-brand-600 hover:bg-brand-700 rounded px-6 py-2 text-sm font-medium transition-colors"
          >
            View Policies
          </a>
        </div>
      )}

      <TransactionToast loading={loading} error={error} txSignature={txSignature} />
    </div>
  );
}
