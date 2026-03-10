export type ChainId = "solana" | "ethereum";

export interface ChainConfig {
  id: ChainId;
  name: string;
  explorerUrl: string;
  explorerTxPath: string;
  nativeToken: string;
  stablecoin: string;
}

export const SOLANA_CONFIG: ChainConfig = {
  id: "solana",
  name: "Solana",
  explorerUrl: "https://solscan.io",
  explorerTxPath: "/tx/",
  nativeToken: "SOL",
  stablecoin: "USDC",
};

export const ETHEREUM_CONFIG: ChainConfig = {
  id: "ethereum",
  name: "Ethereum",
  explorerUrl: "https://etherscan.io",
  explorerTxPath: "/tx/",
  nativeToken: "ETH",
  stablecoin: "USDC",
};

// ── Normalized data models ──────────────────────────────────────────

export interface NormalizedCustomer {
  owner: string;
  kycVerified: boolean;
  policyCount: number;
  totalClaims: number;
  createdAt: number;
}

export interface NormalizedPolicy {
  id: string;
  owner: string;
  insuredValue: number;        // human-readable USD
  premium: number;             // human-readable USD
  deductibleBps: number;
  coverageType: "theftOnly" | "theftAndLoss";
  paymentFrequency: "monthly" | "annual";
  status: "active" | "expired" | "claimed" | "cancelled" | "suspended";
  durationDays: number;
  startDate: number;
  endDate: number;
  totalPremiumsPaid: number;   // human-readable USD
}

export interface NormalizedPoolState {
  totalCapitalUsdc: number;    // human-readable USD
  totalCapitalSol: number;     // human-readable SOL (0 for Ethereum)
  totalLpSupply: number;
  lpFeeBps: number;
  totalPremiumsCollected: number;
  totalClaimsPaid: number;
  totalInterestEarned: number;
  totalDeployedUsdc: number;
  scrCoverageRatio: number;    // in bps
  paused: boolean;
  supportsNativeDeposit: boolean;
}

export interface NormalizedProtocolState {
  totalPolicies: number;
  activePolicies: number;
  maxPolicies: number;
  platformFeeBps: number;
  maxInsuredValue: number;
  totalPremiumsCollected: number;
  paused: boolean;
}

export interface NormalizedClaimsState {
  totalClaims: number;
  approvedClaims: number;
  rejectedClaims: number;
  totalPaidOut: number;
  maxAutoPayout: number;
  dailyAutoPayoutLimit: number;
  paused: boolean;
}

export interface NormalizedLPPosition {
  owner: string;
  lpTokens: number;
  usdcDeposited: number;       // human-readable USD
  solDeposited: number;        // human-readable SOL (0 for Ethereum)
  rewardsEarned: number;       // human-readable USD
  depositedAt: number;
}

// ── Hook interfaces ─────────────────────────────────────────────────

export interface IDataHook<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface IExistsHook<T> {
  data: T | null;
  exists: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export interface IPoliciesHook {
  policies: NormalizedPolicy[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export interface ITransactionResult {
  loading: boolean;
  error: string | null;
  txSignature: string | null;
}

export interface CreatePolicyParams {
  watchDetailsHash: number[];
  insuredValue: number;        // human-readable USD
  premium: number;             // human-readable USD
  deductibleBps: number;
  coverageType: "theftOnly" | "theftAndLoss";
  paymentFrequency: "monthly" | "annual";
  durationDays: number;
}

export interface IPolicyholderActions extends ITransactionResult {
  registerCustomer: (kycHash: number[]) => Promise<string | undefined>;
  createPolicy: (params: CreatePolicyParams) => Promise<string | undefined>;
  payPremium: (policyId: string, amount: number) => Promise<string | undefined>;
  cancelPolicy: (policyId: string) => Promise<string | undefined>;
  submitClaim: (
    policyId: string,
    claimType: "theft" | "loss",
    documentsHash: number[],
    claimedAmount: number,
  ) => Promise<string | undefined>;
}

export interface ILPProviderActions extends ITransactionResult {
  depositStablecoin: (amount: number) => Promise<string | undefined>;
  depositNative?: (amount: number) => Promise<string | undefined>;
  withdrawStablecoin: (lpTokens: number) => Promise<string | undefined>;
  withdrawNative?: (lpTokens: number) => Promise<string | undefined>;
}

// ── Chain adapter interface ─────────────────────────────────────────

export interface ChainAdapter {
  config: ChainConfig;
  walletAddress: string | null;
  connected: boolean;
  connecting: boolean;
  isDemo: boolean;
  connect: () => void;
  disconnect: () => void;
  usePoolState: () => IDataHook<NormalizedPoolState>;
  useCustomer: () => IExistsHook<NormalizedCustomer>;
  useProtocolState: () => IDataHook<NormalizedProtocolState>;
  useClaimsState: () => IDataHook<NormalizedClaimsState>;
  useLPPosition: () => IExistsHook<NormalizedLPPosition>;
  usePolicies: () => IPoliciesHook;
  usePolicyholder: () => IPolicyholderActions;
  useLPProvider: () => ILPProviderActions;
}
