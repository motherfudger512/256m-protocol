import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";

import {
  LIQUIDITY_POOL_PROGRAM_ID,
  CLAIMS_PROCESSOR_PROGRAM_ID,
  POLICY_MANAGER_PROGRAM_ID,
  TREASURY_PROGRAM_ID,
  deriveTreasuryState,
  deriveTreasuryVaultUsdc,
  deriveTreasuryVaultSol,
  derivePoolState,
  derivePoolVaultUsdc,
  derivePoolVaultSol,
  deriveLpTokenMint,
  deriveProtocolState,
  deriveClaimsState,
  airdropSol,
  getSharedUsdcMint,
  SHARED_ORACLE,
} from "./setup";

// ── Load programs from workspace ──────────────────────────────────────────────
const liquidityPoolProgram = anchor.workspace.LiquidityPool as Program;
const claimsProcessorProgram = anchor.workspace.ClaimsProcessor as Program;
const policyManagerProgram = anchor.workspace.PolicyManager as Program;
const treasuryProgram = anchor.workspace.Treasury as Program;

// ── Provider & Admin ──────────────────────────────────────────────────────────
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const admin = (provider.wallet as anchor.Wallet).payer;

// ── Module-level variables ────────────────────────────────────────────────────
let usdcMint: PublicKey;
const oracleKeypair = SHARED_ORACLE;

// Treasury PDAs
let treasuryState: PublicKey;
let treasuryStateBump: number;
let vaultUsdc: PublicKey;
let vaultSol: PublicKey;

// Liquidity Pool PDAs
let poolState: PublicKey;
let poolStateBump: number;
let poolVaultUsdc: PublicKey;
let poolVaultSol: PublicKey;
let lpTokenMint: PublicKey;

// Policy Manager PDAs
let protocolState: PublicKey;
let protocolStateBump: number;

// Claims Processor PDAs
let claimsState: PublicKey;
let claimsStateBump: number;

describe("256M Protocol - Initialization", () => {
  before(async () => {
    // Airdrop SOL to admin for transaction fees
    await airdropSol(provider.connection, admin.publicKey, 100 * LAMPORTS_PER_SOL);

    // Get shared USDC mint (6 decimals) with admin as mint authority
    usdcMint = await getSharedUsdcMint(provider, admin);

    // Derive all PDAs

    // Treasury
    [treasuryState, treasuryStateBump] = deriveTreasuryState();
    [vaultUsdc] = deriveTreasuryVaultUsdc();
    [vaultSol] = deriveTreasuryVaultSol();

    // Liquidity Pool
    [poolState, poolStateBump] = derivePoolState();
    [poolVaultUsdc] = derivePoolVaultUsdc();
    [poolVaultSol] = derivePoolVaultSol();
    [lpTokenMint] = deriveLpTokenMint();

    // Policy Manager
    [protocolState, protocolStateBump] = deriveProtocolState();

    // Claims Processor
    [claimsState, claimsStateBump] = deriveClaimsState();
  });

  // ── 1. Treasury Initialization ──────────────────────────────────────────────
  it("should initialize treasury", async () => {
    const withdrawalThreshold = new BN(1_000_000);

    await treasuryProgram.methods
      .initializeTreasury(withdrawalThreshold)
      .accounts({
        treasuryState: treasuryState,
        vaultUsdc: vaultUsdc,
        vaultSol: vaultSol,
        usdcMint: usdcMint,
        authority: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Fetch and verify treasury state
    const state = await treasuryProgram.account.treasuryState.fetch(treasuryState);

    expect(state.authority.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(state.vaultUsdc.toBase58()).to.equal(vaultUsdc.toBase58());
    expect(state.vaultSol.toBase58()).to.equal(vaultSol.toBase58());
    expect(state.totalFeesCollected.toNumber()).to.equal(0);
    expect(state.platformFees.toNumber()).to.equal(0);
    expect(state.lpServiceFees.toNumber()).to.equal(0);
    expect(state.totalWithdrawn.toNumber()).to.equal(0);
    expect(state.withdrawalThreshold.toNumber()).to.equal(1_000_000);
  });

  // ── 2. Liquidity Pool Initialization ────────────────────────────────────────
  it("should initialize liquidity pool", async () => {
    const lpFeeBps = 200;
    const maxDeploymentBps = 7000;

    await liquidityPoolProgram.methods
      .initializePool(lpFeeBps, maxDeploymentBps)
      .accounts({
        poolState: poolState,
        poolVaultUsdc: poolVaultUsdc,
        poolVaultSol: poolVaultSol,
        lpTokenMint: lpTokenMint,
        usdcMint: usdcMint,
        authority: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Fetch and verify pool state
    const state = await liquidityPoolProgram.account.poolState.fetch(poolState);

    expect(state.authority.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(state.poolVaultUsdc.toBase58()).to.equal(poolVaultUsdc.toBase58());
    expect(state.poolVaultSol.toBase58()).to.equal(poolVaultSol.toBase58());
    expect(state.lpTokenMint.toBase58()).to.equal(lpTokenMint.toBase58());
    expect(state.lpFeeBps).to.equal(200);
    expect(state.maxDeploymentBps).to.equal(7000);
    expect(state.scrCoverageRatio).to.equal(10000);
    expect(state.totalLpSupply.toNumber()).to.equal(0);
    expect(state.totalCapitalUsdc.toNumber()).to.equal(0);
    expect(state.totalCapitalSol.toNumber()).to.equal(0);
    expect(state.statutoryCapitalRequired.toNumber()).to.equal(0);
    expect(state.totalPremiumsCollected.toNumber()).to.equal(0);
    expect(state.totalClaimsPaid.toNumber()).to.equal(0);
    expect(state.totalInterestEarned.toNumber()).to.equal(0);
    expect(state.totalDeployedUsdc.toNumber()).to.equal(0);
    expect(state.totalDeployedSol.toNumber()).to.equal(0);
  });

  // ── 3. Reject Pool Init with Fee > 2000 ────────────────────────────────────
  it("should reject pool init with fee > 2000", async () => {
    try {
      await liquidityPoolProgram.methods
        .initializePool(2001, 7000)
        .accounts({
          poolState: poolState,
          poolVaultUsdc: poolVaultUsdc,
          poolVaultSol: poolVaultSol,
          lpTokenMint: lpTokenMint,
          usdcMint: usdcMint,
          authority: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).to.exist;
    }
  });

  // ── 4. Policy Manager Initialization ────────────────────────────────────────
  it("should initialize policy manager", async () => {
    const platformFeeBps = 500;
    const maxPolicies = new BN(5000);
    const maxInsuredValue = new BN(30_000_000_000);

    await policyManagerProgram.methods
      .initializeProtocol(platformFeeBps, maxPolicies, maxInsuredValue)
      .accounts({
        protocolState: protocolState,
        treasury: TREASURY_PROGRAM_ID,
        liquidityPool: LIQUIDITY_POOL_PROGRAM_ID,
        authority: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Fetch and verify protocol state
    const state = await policyManagerProgram.account.protocolState.fetch(protocolState);

    expect(state.authority.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(state.treasury.toBase58()).to.equal(TREASURY_PROGRAM_ID.toBase58());
    expect(state.liquidityPool.toBase58()).to.equal(LIQUIDITY_POOL_PROGRAM_ID.toBase58());
    expect(state.platformFeeBps).to.equal(500);
    expect(state.totalPolicies.toNumber()).to.equal(0);
    expect(state.activePolicies.toNumber()).to.equal(0);
    expect(state.maxPolicies.toNumber()).to.equal(5000);
    expect(state.maxInsuredValue.toNumber()).to.equal(30_000_000_000);
    expect(state.totalPremiumsCollected.toNumber()).to.equal(0);
  });

  // ── 5. Claims Processor Initialization ──────────────────────────────────────
  it("should initialize claims processor", async () => {
    const maxAutoPayout = new BN(10_000_000_000);
    const dailyAutoPayoutLimit = new BN(50_000_000_000);

    await claimsProcessorProgram.methods
      .initializeClaimsSystem(maxAutoPayout, dailyAutoPayoutLimit, oracleKeypair.publicKey)
      .accounts({
        claimsState: claimsState,
        policyManager: POLICY_MANAGER_PROGRAM_ID,
        liquidityPool: LIQUIDITY_POOL_PROGRAM_ID,
        authority: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Fetch and verify claims state
    const state = await claimsProcessorProgram.account.claimsState.fetch(claimsState);

    expect(state.authority.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(state.policyManager.toBase58()).to.equal(POLICY_MANAGER_PROGRAM_ID.toBase58());
    expect(state.liquidityPool.toBase58()).to.equal(LIQUIDITY_POOL_PROGRAM_ID.toBase58());
    expect(state.aiOracle.toBase58()).to.equal(oracleKeypair.publicKey.toBase58());
    expect(state.totalClaims.toNumber()).to.equal(0);
    expect(state.approvedClaims.toNumber()).to.equal(0);
    expect(state.rejectedClaims.toNumber()).to.equal(0);
    expect(state.totalPaidOut.toNumber()).to.equal(0);
    expect(state.maxAutoPayout.toNumber()).to.equal(10_000_000_000);
    expect(state.dailyAutoPayoutLimit.toNumber()).to.equal(50_000_000_000);
    expect(state.dailyAutoPaid.toNumber()).to.equal(0);
  });
});
