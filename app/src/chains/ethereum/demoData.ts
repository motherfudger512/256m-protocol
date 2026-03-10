import type {
  NormalizedCustomer,
  NormalizedPolicy,
  NormalizedPoolState,
  NormalizedProtocolState,
  NormalizedClaimsState,
  NormalizedLPPosition,
} from "../types";

const now = Math.floor(Date.now() / 1000);
const dayInSecs = 86400;

const demoAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

export function getEthDemoCustomer(): NormalizedCustomer {
  return {
    owner: demoAddress,
    kycVerified: true,
    policyCount: 3,
    totalClaims: 0,
    createdAt: now - 30 * dayInSecs,
  };
}

export function getEthDemoPolicies(): NormalizedPolicy[] {
  return [
    {
      id: "1",
      owner: demoAddress,
      insuredValue: 25_000,
      premium: 125,
      deductibleBps: 500,
      coverageType: "theftAndLoss",
      paymentFrequency: "monthly",
      status: "active",
      durationDays: 365,
      startDate: now - 15 * dayInSecs,
      endDate: now + 350 * dayInSecs,
      totalPremiumsPaid: 250,
    },
    {
      id: "2",
      owner: demoAddress,
      insuredValue: 50_000,
      premium: 250,
      deductibleBps: 300,
      coverageType: "theftOnly",
      paymentFrequency: "annual",
      status: "active",
      durationDays: 730,
      startDate: now - 60 * dayInSecs,
      endDate: now + 670 * dayInSecs,
      totalPremiumsPaid: 3_000,
    },
    {
      id: "3",
      owner: demoAddress,
      insuredValue: 10_000,
      premium: 50,
      deductibleBps: 1000,
      coverageType: "theftAndLoss",
      paymentFrequency: "monthly",
      status: "cancelled",
      durationDays: 365,
      startDate: now - 90 * dayInSecs,
      endDate: now + 275 * dayInSecs,
      totalPremiumsPaid: 150,
    },
  ];
}

export const ethDemoProtocolState: NormalizedProtocolState = {
  totalPolicies: 147,
  activePolicies: 89,
  maxPolicies: 10000,
  platformFeeBps: 250,
  maxInsuredValue: 500_000,
  totalPremiumsCollected: 42_500,
  paused: false,
};

export const ethDemoPoolState: NormalizedPoolState = {
  totalCapitalUsdc: 2_750_000,
  totalCapitalSol: 0,
  totalLpSupply: 2_500_000,
  lpFeeBps: 100,
  totalPremiumsCollected: 42_500,
  totalClaimsPaid: 8_200,
  totalInterestEarned: 3_100,
  totalDeployedUsdc: 500_000,
  scrCoverageRatio: 15000,
  paused: false,
  supportsNativeDeposit: false,
};

export function getEthDemoLPPosition(): NormalizedLPPosition {
  return {
    owner: demoAddress,
    lpTokens: 125_000,
    usdcDeposited: 150_000,
    solDeposited: 0,
    rewardsEarned: 2_340,
    depositedAt: now - 45 * dayInSecs,
  };
}

export const ethDemoClaimsState: NormalizedClaimsState = {
  totalClaims: 23,
  approvedClaims: 14,
  rejectedClaims: 7,
  totalPaidOut: 8_200,
  maxAutoPayout: 5_000,
  dailyAutoPayoutLimit: 25_000,
  paused: false,
};

export function fakeEthTxHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
