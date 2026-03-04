import { PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";

const now = Math.floor(Date.now() / 1000);
const dayInSecs = 86400;

// Deterministic fake keys for demo
const fakePolicyKey1 = Keypair.generate().publicKey;
const fakePolicyKey2 = Keypair.generate().publicKey;
const fakePolicyKey3 = Keypair.generate().publicKey;
const fakeClaimKey1 = Keypair.generate().publicKey;

export function getDemoCustomer(owner: PublicKey) {
  return {
    owner,
    kycVerified: true,
    kycHash: Array(32).fill(0),
    policies: [fakePolicyKey1, fakePolicyKey2, fakePolicyKey3],
    totalPolicies: new BN(3),
    createdAt: new BN(now - 30 * dayInSecs),
  };
}

export function getDemoPolicies(owner: PublicKey) {
  return [
    {
      publicKey: fakePolicyKey1,
      account: {
        owner,
        policyId: new BN(1),
        watchDetailsHash: Array(32).fill(1),
        insuredValue: new BN(25_000_000_000), // $25,000
        premium: new BN(125_000_000), // $125/month
        deductibleBps: 500, // 5%
        coverageType: { theftAndLoss: {} },
        paymentFrequency: { monthly: {} },
        status: { active: {} },
        durationDays: 365,
        startDate: new BN(now - 15 * dayInSecs),
        endDate: new BN(now + 350 * dayInSecs),
        lastPremiumPaid: new BN(now - 2 * dayInSecs),
        totalPremiumsPaid: new BN(250_000_000), // $250
        createdAt: new BN(now - 15 * dayInSecs),
      },
    },
    {
      publicKey: fakePolicyKey2,
      account: {
        owner,
        policyId: new BN(2),
        watchDetailsHash: Array(32).fill(2),
        insuredValue: new BN(50_000_000_000), // $50,000
        premium: new BN(250_000_000), // $250/month
        deductibleBps: 300, // 3%
        coverageType: { theftOnly: {} },
        paymentFrequency: { annual: {} },
        status: { active: {} },
        durationDays: 730,
        startDate: new BN(now - 60 * dayInSecs),
        endDate: new BN(now + 670 * dayInSecs),
        lastPremiumPaid: new BN(now - 60 * dayInSecs),
        totalPremiumsPaid: new BN(3_000_000_000), // $3,000
        createdAt: new BN(now - 60 * dayInSecs),
      },
    },
    {
      publicKey: fakePolicyKey3,
      account: {
        owner,
        policyId: new BN(3),
        watchDetailsHash: Array(32).fill(3),
        insuredValue: new BN(10_000_000_000), // $10,000
        premium: new BN(50_000_000), // $50/month
        deductibleBps: 1000, // 10%
        coverageType: { theftAndLoss: {} },
        paymentFrequency: { monthly: {} },
        status: { cancelled: {} },
        durationDays: 365,
        startDate: new BN(now - 90 * dayInSecs),
        endDate: new BN(now + 275 * dayInSecs),
        lastPremiumPaid: new BN(now - 45 * dayInSecs),
        totalPremiumsPaid: new BN(150_000_000), // $150
        createdAt: new BN(now - 90 * dayInSecs),
      },
    },
  ];
}

export const demoProtocolState = {
  authority: Keypair.generate().publicKey,
  totalPolicies: new BN(147),
  activePolicies: new BN(89),
  maxPolicies: new BN(10000),
  platformFeeBps: 250, // 2.5%
  maxInsuredValue: new BN(500_000_000_000), // $500k
  totalPremiumsCollected: new BN(42_500_000_000), // $42,500
  paused: false,
};

export const demoPoolState = {
  authority: Keypair.generate().publicKey,
  totalCapitalUsdc: new BN(2_750_000_000_000), // $2.75M
  totalCapitalSol: new BN(15_000_000_000_000), // 15,000 SOL
  totalLpSupply: new BN(2_500_000),
  lpFeeBps: 100, // 1%
  totalPremiumsCollected: new BN(42_500_000_000), // $42,500
  totalClaimsPaid: new BN(8_200_000_000), // $8,200
  totalInterestEarned: new BN(3_100_000_000), // $3,100
  totalDeployedUsdc: new BN(500_000_000_000), // $500k
  scrCoverageRatio: 15000, // 150%
  paused: false,
};

export function getDemoLpPosition(owner: PublicKey) {
  return {
    owner,
    lpTokens: new BN(125_000),
    usdcDeposited: new BN(150_000_000_000), // $150k
    solDeposited: new BN(500_000_000_000), // 500 SOL
    rewardsEarned: new BN(2_340_000_000), // $2,340
    depositedAt: new BN(now - 45 * dayInSecs),
  };
}

export const demoClaimsState = {
  authority: Keypair.generate().publicKey,
  totalClaims: new BN(23),
  approvedClaims: new BN(14),
  rejectedClaims: new BN(7),
  totalPaidOut: new BN(8_200_000_000), // $8,200
  maxAutoPayout: new BN(5_000_000_000), // $5,000
  dailyAutoPayoutLimit: new BN(25_000_000_000), // $25,000
  paused: false,
};

// Fake transaction signature for demo write ops
export function fakeTxSignature(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
