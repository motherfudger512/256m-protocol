/**
 * 256M Actuarial Pricing Engine
 *
 * Implements the 256M Luxury Watch Insurance actuarial model with 15 risk factors.
 * All multipliers and base rates are derived from the actuarial model.
 */

// ── Base Actuarial Assumptions ──────────────────────────────────────────────

const THEFT_BASE_RATE = 3.5 / 1000; // per-policy per-year
const LOSS_BASE_RATE = 2.5 / 1000;

const THEFT_PAYOUT_RATE = 1.0; // 100% payout (0% deductible for theft)
const LOSS_PAYOUT_RATE = 0.8; // 80% payout (20% deductible for loss)

const FRAUD_ADJUSTMENT_RATE = 0.01; // 1% built into pure premium
const LOADING_FACTOR = 1.5; // 50% total loading (25% expense + 25% risk/profit)

export const MAX_INSURED_VALUE = 35_000; // USD – single-policy cap
const MAX_PREMIUM_RATIO = 0.85; // annual premium capped at 85% of insured value

// ── Risk Factor Enums & Multiplier Tables ───────────────────────────────────

export type BrandTier = "ultra_luxury" | "high_luxury" | "luxury" | "premium";
export type Country = "uk" | "italy" | "france" | "germany" | "switzerland" | "belgium";
export type StorageSecurity = "safe_and_alarm" | "safe" | "alarm" | "standard" | "none";
export type WearFrequency = "occasional" | "rotation" | "weekly" | "daily";
export type AgeGroup = "18_25" | "26_34" | "35_49" | "50_plus";
export type UrbanDensity = "rural" | "suburban" | "city" | "major_city";
export type Recognizability = "iconic" | "well_known" | "moderate" | "low";
export type PostcodeRisk = "very_high" | "high" | "moderate" | "low" | "very_low";
export type ClaimsHistory = "multiple" | "two" | "one" | "none";
export type GPSTracking = "active" | "none";
export type PurchaseRecency = "first_90" | "91_180" | "over_180";

export const BRAND_TIER_OPTIONS: { value: BrandTier; label: string; examples: string; multiplier: number }[] = [
  { value: "ultra_luxury", label: "Ultra Luxury", examples: "Patek Philippe, Audemars Piguet, Vacheron Constantin", multiplier: 3.5 },
  { value: "high_luxury", label: "High Luxury", examples: "Rolex, Omega", multiplier: 2.8 },
  { value: "luxury", label: "Luxury", examples: "TAG Heuer, Breitling, IWC", multiplier: 1.5 },
  { value: "premium", label: "Premium", examples: "Longines, Oris", multiplier: 1.0 },
];

export const COUNTRY_OPTIONS: { value: Country; label: string; multiplier: number }[] = [
  { value: "uk", label: "United Kingdom", multiplier: 2.2 },
  { value: "italy", label: "Italy", multiplier: 1.8 },
  { value: "france", label: "France", multiplier: 1.5 },
  { value: "belgium", label: "Belgium", multiplier: 1.4 },
  { value: "germany", label: "Germany", multiplier: 1.2 },
  { value: "switzerland", label: "Switzerland", multiplier: 0.8 },
];

export const STORAGE_OPTIONS: { value: StorageSecurity; label: string; multiplier: number }[] = [
  { value: "safe_and_alarm", label: "Home Safe + Alarm System", multiplier: 0.5 },
  { value: "safe", label: "Home Safe", multiplier: 0.7 },
  { value: "alarm", label: "Alarm System Only", multiplier: 0.85 },
  { value: "standard", label: "Standard (No Special Security)", multiplier: 1.0 },
  { value: "none", label: "No Security", multiplier: 1.5 },
];

export const WEAR_OPTIONS: { value: WearFrequency; label: string; multiplier: number }[] = [
  { value: "occasional", label: "Occasional (Special events)", multiplier: 0.6 },
  { value: "rotation", label: "Rotation (Multiple watches)", multiplier: 0.8 },
  { value: "weekly", label: "Weekly", multiplier: 1.0 },
  { value: "daily", label: "Daily Wear", multiplier: 1.3 },
];

export const AGE_OPTIONS: { value: AgeGroup; label: string; multiplier: number }[] = [
  { value: "50_plus", label: "50+", multiplier: 0.7 },
  { value: "35_49", label: "35–49", multiplier: 0.9 },
  { value: "26_34", label: "26–34", multiplier: 1.0 },
  { value: "18_25", label: "18–25", multiplier: 1.4 },
];

export const URBAN_OPTIONS: { value: UrbanDensity; label: string; multiplier: number }[] = [
  { value: "rural", label: "Rural / Small Town", multiplier: 0.6 },
  { value: "suburban", label: "Suburban", multiplier: 0.85 },
  { value: "city", label: "City", multiplier: 1.0 },
  { value: "major_city", label: "Major City Centre", multiplier: 1.5 },
];

export const RECOGNIZABILITY_OPTIONS: { value: Recognizability; label: string; examples: string; multiplier: number }[] = [
  { value: "iconic", label: "Iconic / Instantly Recognisable", examples: "Nautilus, Daytona, Royal Oak", multiplier: 1.5 },
  { value: "well_known", label: "Well-Known", examples: "Submariner, Speedmaster, GMT-Master", multiplier: 1.2 },
  { value: "moderate", label: "Moderate Recognition", examples: "Known by enthusiasts", multiplier: 1.0 },
  { value: "low", label: "Low Recognition", examples: "Less known models", multiplier: 0.8 },
];

export const POSTCODE_OPTIONS: { value: PostcodeRisk; label: string; multiplier: number }[] = [
  { value: "very_high", label: "Very High Crime Area", multiplier: 1.8 },
  { value: "high", label: "High Crime Area", multiplier: 1.4 },
  { value: "moderate", label: "Moderate Crime Area", multiplier: 1.0 },
  { value: "low", label: "Low Crime Area", multiplier: 0.8 },
  { value: "very_low", label: "Very Low Crime Area", multiplier: 0.7 },
];

export const CLAIMS_HISTORY_OPTIONS: { value: ClaimsHistory; label: string; multiplier: number }[] = [
  { value: "none", label: "No Prior Claims", multiplier: 1.0 },
  { value: "one", label: "One Prior Claim", multiplier: 1.25 },
  { value: "two", label: "Two Prior Claims", multiplier: 1.5 },
  { value: "multiple", label: "Three or More Claims", multiplier: 2.0 },
];

export const GPS_OPTIONS: { value: GPSTracking; label: string; multiplier: number }[] = [
  { value: "active", label: "Active GPS / AirTag", multiplier: 0.7 },
  { value: "none", label: "No Tracking", multiplier: 1.0 },
];

export const PURCHASE_RECENCY_OPTIONS: { value: PurchaseRecency; label: string; multiplier: number }[] = [
  { value: "over_180", label: "More than 180 days ago", multiplier: 1.0 },
  { value: "91_180", label: "91–180 days ago", multiplier: 1.1 },
  { value: "first_90", label: "Within the last 90 days", multiplier: 1.3 },
];

// ── Multiplier Lookups ──────────────────────────────────────────────────────

function lookup<T extends string>(
  options: { value: T; multiplier: number }[],
  value: T,
): number {
  return options.find((o) => o.value === value)?.multiplier ?? 1.0;
}

// ── Quote Input / Output Types ──────────────────────────────────────────────

export interface QuoteInput {
  watchValue: number; // in EUR/USDC
  brandTier: BrandTier;
  country: Country;
  storageSecurity: StorageSecurity;
  wearFrequency: WearFrequency;
  ageGroup: AgeGroup;
  urbanDensity: UrbanDensity;
  recognizability: Recognizability;
  postcodeRisk: PostcodeRisk;
  claimsHistory: ClaimsHistory;
  gpsTracking: GPSTracking;
  purchaseRecency: PurchaseRecency;
  coverageType: "theftOnly" | "theftAndLoss";
  paymentFrequency: "monthly" | "annual";
  durationDays: number;
}

export interface QuoteBreakdown {
  // Risk scores
  coreRiskScore: number;
  enhancedRiskScore: number;

  // Frequencies
  adjustedTheftFrequency: number;
  adjustedLossFrequency: number;
  combinedFrequency: number;

  // Pure premiums
  theftPurePremium: number;
  lossPurePremium: number;
  fraudAdjustment: number;
  totalPurePremium: number;

  // Final premiums
  grossPremiumAnnual: number;
  grossPremiumMonthly: number;
  ratePercent: number;

  // What the customer pays
  premiumAmount: number; // based on payment frequency
  premiumLabel: string; // "per year" or "per month"

  // For on-chain (per-period premium in USDC base units)
  premiumUsdc: number;

  // Factor breakdown for display
  factors: { label: string; category: string; multiplier: number }[];

  // Deductible
  deductibleBps: number;
}

// ── Risk Level Scale ────────────────────────────────────────────────────────

// Theoretical bounds computed from min/max of every multiplier table:
//   min = 1.0 × 0.8 × 0.5 × 0.6 × 0.7 × 0.6 × 0.8 × 0.7 × 1.0 × 0.7 × 1.0 ≈ 0.0395
//   max = 3.5 × 2.2 × 1.5 × 1.3 × 1.4 × 1.5 × 1.5 × 1.8 × 2.0 × 1.0 × 1.3 ≈ 221.35
const LOG_MIN = Math.log(0.0395);
const LOG_MAX = Math.log(221.35);
export const RISK_LEVEL_MAX = 10;

/**
 * Maps a raw enhanced risk score to an integer 0–10 on a logarithmic scale.
 * 0 = lowest possible risk, 10 = highest possible risk.
 */
export function riskScoreToLevel(score: number): number {
  if (score <= 0) return 0;
  const logScore = Math.log(score);
  const normalized = (logScore - LOG_MIN) / (LOG_MAX - LOG_MIN);
  const clamped = Math.max(0, Math.min(1, normalized));
  return Math.round(clamped * RISK_LEVEL_MAX);
}

// ── Core Calculation ────────────────────────────────────────────────────────

export function calculateQuote(input: QuoteInput): QuoteBreakdown {
  const brandMultiplier = lookup(BRAND_TIER_OPTIONS, input.brandTier);
  const countryMultiplier = lookup(COUNTRY_OPTIONS, input.country);
  const storageMultiplier = lookup(STORAGE_OPTIONS, input.storageSecurity);
  const wearMultiplier = lookup(WEAR_OPTIONS, input.wearFrequency);
  const ageMultiplier = lookup(AGE_OPTIONS, input.ageGroup);
  const urbanMultiplier = lookup(URBAN_OPTIONS, input.urbanDensity);
  const recognizabilityMultiplier = lookup(RECOGNIZABILITY_OPTIONS, input.recognizability);
  const postcodeMultiplier = lookup(POSTCODE_OPTIONS, input.postcodeRisk);
  const claimsMultiplier = lookup(CLAIMS_HISTORY_OPTIONS, input.claimsHistory);
  const gpsMultiplier = lookup(GPS_OPTIONS, input.gpsTracking);
  const purchaseMultiplier = lookup(PURCHASE_RECENCY_OPTIONS, input.purchaseRecency);

  // Core 6-factor risk score
  const coreRiskScore =
    brandMultiplier *
    countryMultiplier *
    storageMultiplier *
    wearMultiplier *
    ageMultiplier *
    urbanMultiplier;

  // Enhanced 11-factor risk score (core × enhanced factors)
  const enhancedRiskScore =
    coreRiskScore *
    recognizabilityMultiplier *
    postcodeMultiplier *
    claimsMultiplier *
    gpsMultiplier *
    purchaseMultiplier;

  // Adjusted frequencies using enhanced risk score
  const adjustedTheftFrequency = THEFT_BASE_RATE * enhancedRiskScore;
  const adjustedLossFrequency = LOSS_BASE_RATE * enhancedRiskScore;
  const combinedFrequency = adjustedTheftFrequency + adjustedLossFrequency;

  // Pure premium calculation
  const theftPurePremium = adjustedTheftFrequency * input.watchValue * THEFT_PAYOUT_RATE;
  let lossPurePremium = 0;
  if (input.coverageType === "theftAndLoss") {
    lossPurePremium = adjustedLossFrequency * input.watchValue * LOSS_PAYOUT_RATE;
  }

  const basePure = theftPurePremium + lossPurePremium;
  const fraudAdjustment = basePure * FRAUD_ADJUSTMENT_RATE;
  const totalPurePremium = basePure + fraudAdjustment;

  // Gross premium with loadings, capped at 85% of insured value
  const uncappedAnnual = totalPurePremium * LOADING_FACTOR;
  const grossPremiumAnnual = Math.min(uncappedAnnual, input.watchValue * MAX_PREMIUM_RATIO);
  const grossPremiumMonthly = grossPremiumAnnual / 12;
  const ratePercent = (grossPremiumAnnual / input.watchValue) * 100;

  // What the customer actually pays per period
  const premiumAmount = input.paymentFrequency === "monthly" ? grossPremiumMonthly : grossPremiumAnnual;
  const premiumLabel = input.paymentFrequency === "monthly" ? "per month" : "per year";

  // For on-chain: premium per payment period
  const premiumUsdc = Math.round(premiumAmount * 100) / 100;

  // Deductible: theft = 0%, loss component uses 20% (2000 bps)
  // We set deductible based on coverage type
  const deductibleBps = input.coverageType === "theftAndLoss" ? 2000 : 0;

  // Factor breakdown for transparency
  const factors = [
    { label: "Brand Tier", category: "Watch", multiplier: brandMultiplier },
    { label: "Recognisability", category: "Watch", multiplier: recognizabilityMultiplier },
    { label: "Country", category: "Location", multiplier: countryMultiplier },
    { label: "Postcode Risk", category: "Location", multiplier: postcodeMultiplier },
    { label: "Urban Density", category: "Location", multiplier: urbanMultiplier },
    { label: "Storage Security", category: "Security", multiplier: storageMultiplier },
    { label: "GPS Tracking", category: "Security", multiplier: gpsMultiplier },
    { label: "Wear Frequency", category: "Usage", multiplier: wearMultiplier },
    { label: "Age Group", category: "Personal", multiplier: ageMultiplier },
    { label: "Claims History", category: "Personal", multiplier: claimsMultiplier },
    { label: "Purchase Recency", category: "Personal", multiplier: purchaseMultiplier },
  ];

  return {
    coreRiskScore,
    enhancedRiskScore,
    adjustedTheftFrequency,
    adjustedLossFrequency,
    combinedFrequency,
    theftPurePremium,
    lossPurePremium,
    fraudAdjustment,
    totalPurePremium,
    grossPremiumAnnual,
    grossPremiumMonthly,
    ratePercent,
    premiumAmount,
    premiumLabel,
    premiumUsdc,
    factors,
    deductibleBps,
  };
}
