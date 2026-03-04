import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
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
  deriveLpPosition,
  deriveProtocolState,
  deriveCustomer,
  derivePolicy,
  deriveClaimsState,
  deriveClaim,
  airdropSol,
  getSharedUsdcMint,
  createAndFundATA,
  getATA,
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

// ── Keypairs ──────────────────────────────────────────────────────────────────
const policyholder = Keypair.generate();
const lpProvider = Keypair.generate();
const oracleKeypair = SHARED_ORACLE;

// ── Module-level variables ────────────────────────────────────────────────────
let usdcMint: PublicKey;
let policyholderUsdcAta: PublicKey;
let lpProviderUsdcAta: PublicKey;

// Treasury PDAs
let treasuryState: PublicKey;
let vaultUsdc: PublicKey;
let vaultSol: PublicKey;

// Liquidity Pool PDAs
let poolState: PublicKey;
let poolVaultUsdc: PublicKey;
let poolVaultSol: PublicKey;
let lpTokenMint: PublicKey;
let lpPositionPDA: PublicKey;
let lpProviderLpTokenAta: PublicKey;

// Policy Manager PDAs
let protocolState: PublicKey;
let customerPda: PublicKey;
let policyPda: PublicKey;

// Claims Processor PDAs
let claimsState: PublicKey;
let claimPda: PublicKey;

describe("256M Protocol - Claims Journey", () => {
  before(async () => {
    // 1. Airdrop SOL to admin, policyholder, lpProvider
    await airdropSol(provider.connection, admin.publicKey, 100 * LAMPORTS_PER_SOL);
    await airdropSol(provider.connection, policyholder.publicKey, 100 * LAMPORTS_PER_SOL);
    await airdropSol(provider.connection, lpProvider.publicKey, 100 * LAMPORTS_PER_SOL);
    await airdropSol(provider.connection, oracleKeypair.publicKey, 10 * LAMPORTS_PER_SOL);

    // 2. Get shared USDC mint (programs already initialized by test 01)
    usdcMint = await getSharedUsdcMint(provider, admin);

    // Derive all PDAs

    // Treasury
    [treasuryState] = deriveTreasuryState();
    [vaultUsdc] = deriveTreasuryVaultUsdc();
    [vaultSol] = deriveTreasuryVaultSol();

    // Liquidity Pool
    [poolState] = derivePoolState();
    [poolVaultUsdc] = derivePoolVaultUsdc();
    [poolVaultSol] = derivePoolVaultSol();
    [lpTokenMint] = deriveLpTokenMint();
    [lpPositionPDA] = deriveLpPosition(lpProvider.publicKey);

    // Policy Manager
    [protocolState] = deriveProtocolState();
    [customerPda] = deriveCustomer(policyholder.publicKey);

    // Claims Processor
    [claimsState] = deriveClaimsState();

    // 3. Deposit 50,000 USDC into pool (so there's liquidity for payouts)
    lpProviderUsdcAta = await createAndFundATA(
      provider,
      usdcMint,
      lpProvider.publicKey,
      admin,
      100_000_000_000, // 100,000 USDC
    );

    lpProviderLpTokenAta = await getAssociatedTokenAddress(
      lpTokenMint,
      lpProvider.publicKey,
    );

    await liquidityPoolProgram.methods
      .depositLpUsdc(new BN(50_000_000_000)) // 50,000 USDC
      .accounts({
        poolState: poolState,
        lpPosition: lpPositionPDA,
        poolVaultUsdc: poolVaultUsdc,
        lpTokenMint: lpTokenMint,
        depositorUsdc: lpProviderUsdcAta,
        depositorLpToken: lpProviderLpTokenAta,
        depositor: lpProvider.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([lpProvider])
      .rpc();

    // 8. Register + verify policyholder as customer
    const kycHash = Array.from(Buffer.alloc(32, 0xab));

    await policyManagerProgram.methods
      .registerCustomer(kycHash)
      .accounts({
        customer: customerPda,
        owner: policyholder.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([policyholder])
      .rpc();

    await policyManagerProgram.methods
      .verifyCustomer()
      .accounts({
        protocolState: protocolState,
        customer: customerPda,
        authority: admin.publicKey,
      })
      .rpc();

    // 9. Create policy (TheftAndLoss, 365 days, insured_value=10B, premium=500M, deductible_bps=1000)
    const protocolStateFetched = await policyManagerProgram.account.protocolState.fetch(protocolState);
    const nextPolicyId = protocolStateFetched.totalPolicies.toNumber() + 1;
    [policyPda] = derivePolicy(policyholder.publicKey, nextPolicyId);

    const watchDetailsHash = Array.from(Buffer.alloc(32, 0xab));
    const insuredValue = new BN(10_000_000_000);
    const premium = new BN(500_000_000);
    const deductibleBps = 1000;
    const coverageType = { theftAndLoss: {} };
    const paymentFrequency = { annual: {} };
    const durationDays = 365;

    await policyManagerProgram.methods
      .createPolicy(
        watchDetailsHash,
        insuredValue,
        premium,
        deductibleBps,
        coverageType,
        paymentFrequency,
        durationDays,
      )
      .accounts({
        protocolState: protocolState,
        customer: customerPda,
        policy: policyPda,
        payer: policyholder.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([policyholder])
      .rpc();

    // 10. Pay premium
    policyholderUsdcAta = await createAndFundATA(
      provider,
      usdcMint,
      policyholder.publicKey,
      admin,
      50_000_000_000, // 50,000 USDC
    );

    await policyManagerProgram.methods
      .payPremium(new BN(500_000_000))
      .accounts({
        protocolState: protocolState,
        policy: policyPda,
        payerTokenAccount: policyholderUsdcAta,
        treasuryTokenAccount: vaultUsdc,
        poolVault: poolVaultUsdc,
        payer: policyholder.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([policyholder])
      .rpc();
  });

  // ── Test 1: Submit a claim ──────────────────────────────────────────────────
  it("should submit a claim", async () => {
    // Query current total_claims to derive correct claim PDA
    const claimsStateFetched = await claimsProcessorProgram.account.claimsState.fetch(claimsState);
    const nextClaimId = claimsStateFetched.totalClaims.toNumber() + 1;
    [claimPda] = deriveClaim(policyPda, nextClaimId);

    const claimType = { theft: {} };
    const documentsHash = Array.from(Buffer.alloc(32, 0xcd));
    const claimedAmount = new BN(5_000_000_000); // 5,000 USDC

    await claimsProcessorProgram.methods
      .submitClaim(claimType, documentsHash, claimedAmount)
      .accounts({
        claimsState: claimsState,
        policy: policyPda,
        claim: claimPda,
        customer: policyholder.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([policyholder])
      .rpc();

    // Fetch and verify claim
    const claim = await claimsProcessorProgram.account.claim.fetch(claimPda);

    expect(claim.claimId.toNumber()).to.equal(1);
    expect(claim.policy.toBase58()).to.equal(policyPda.toBase58());
    expect(claim.customer.toBase58()).to.equal(policyholder.publicKey.toBase58());
    expect(JSON.stringify(claim.claimType)).to.equal(JSON.stringify({ theft: {} }));
    expect(JSON.stringify(claim.status)).to.equal(JSON.stringify({ submitted: {} }));
    expect(JSON.stringify(claim.aiDecision)).to.equal(JSON.stringify({ pending: {} }));
    expect(claim.aiConfidence).to.equal(0);
    expect(claim.manualReviewer).to.be.null;
    expect(claim.reviewedAt).to.be.null;
    expect(claim.payoutTx).to.be.null;

    // Verify claim_amount = claimed_amount - deductible
    // deductible = 5_000_000_000 * 1000 / 10000 = 500_000_000
    // payout = 5_000_000_000 - 500_000_000 = 4_500_000_000
    expect(claim.claimAmount.toNumber()).to.equal(4_500_000_000);

    // Verify claims_state was updated
    const state = await claimsProcessorProgram.account.claimsState.fetch(claimsState);
    expect(state.totalClaims.toNumber()).to.equal(1);
  });

  // ── Test 2: Reject AI review from non-oracle ───────────────────────────────
  it("should reject AI review from non-oracle", async () => {
    const fakeOracle = Keypair.generate();
    await airdropSol(provider.connection, fakeOracle.publicKey, 10 * LAMPORTS_PER_SOL);

    try {
      await claimsProcessorProgram.methods
        .aiReviewClaim({ approved: {} }, 90)
        .accounts({
          claimsState: claimsState,
          claim: claimPda,
          aiOracle: fakeOracle.publicKey,
        })
        .signers([fakeOracle])
        .rpc();
      expect.fail("Should have thrown an error for unauthorized oracle");
    } catch (err: any) {
      expect(err).to.exist;
    }
  });

  // ── Test 3: AI review claim (approved, confidence 90) ──────────────────────
  it("should AI review claim (approved, confidence 90)", async () => {
    await claimsProcessorProgram.methods
      .aiReviewClaim({ approved: {} }, 90)
      .accounts({
        claimsState: claimsState,
        claim: claimPda,
        aiOracle: oracleKeypair.publicKey,
      })
      .signers([oracleKeypair])
      .rpc();

    // Fetch and verify claim status changed to UnderReview
    const claim = await claimsProcessorProgram.account.claim.fetch(claimPda);

    expect(JSON.stringify(claim.status)).to.equal(JSON.stringify({ underReview: {} }));
    expect(JSON.stringify(claim.aiDecision)).to.equal(JSON.stringify({ approved: {} }));
    expect(claim.aiConfidence).to.equal(90);
  });

  // ── Test 4: Manual review and approve claim ────────────────────────────────
  it("should manual review and approve claim", async () => {
    await claimsProcessorProgram.methods
      .manualReviewClaim(true)
      .accounts({
        claimsState: claimsState,
        claim: claimPda,
        authority: admin.publicKey,
      })
      .rpc();

    // Fetch and verify claim status changed to Approved
    const claim = await claimsProcessorProgram.account.claim.fetch(claimPda);

    expect(JSON.stringify(claim.status)).to.equal(JSON.stringify({ approved: {} }));
    expect(claim.manualReviewer.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(claim.reviewedAt).to.not.be.null;
  });

  // ── Test 5: Execute claim payout (USDC) ────────────────────────────────────
  it("should execute claim payout (USDC)", async () => {
    // Record state before payout
    const claimsStateBefore = await claimsProcessorProgram.account.claimsState.fetch(claimsState);
    const approvedClaimsBefore = claimsStateBefore.approvedClaims.toNumber();
    const totalPaidOutBefore = claimsStateBefore.totalPaidOut.toNumber();

    const policyholderUsdcBefore = (await getAccount(provider.connection, policyholderUsdcAta)).amount;

    await claimsProcessorProgram.methods
      .executeClaimPayout({ usdc: {} })
      .accounts({
        claimsState: claimsState,
        claim: claimPda,
        policy: policyPda,
        poolState: poolState,
        poolVaultUsdc: poolVaultUsdc,
        poolVaultSol: poolVaultSol,
        claimantTokenAccount: policyholderUsdcAta,
        claimant: policyholder.publicKey,
        liquidityPoolProgram: LIQUIDITY_POOL_PROGRAM_ID,
        authority: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Verify claim status is Paid
    const claim = await claimsProcessorProgram.account.claim.fetch(claimPda);
    expect(JSON.stringify(claim.status)).to.equal(JSON.stringify({ paid: {} }));

    // Verify payout_tx is set (non-null)
    expect(claim.payoutTx).to.not.be.null;

    // Verify claims_state.approved_claims incremented
    const claimsStateAfter = await claimsProcessorProgram.account.claimsState.fetch(claimsState);
    expect(claimsStateAfter.approvedClaims.toNumber()).to.equal(approvedClaimsBefore + 1);

    // Verify claims_state.total_paid_out increased by payout amount (4_500_000_000)
    expect(claimsStateAfter.totalPaidOut.toNumber()).to.equal(totalPaidOutBefore + 4_500_000_000);

    // Verify claimant received USDC
    const policyholderUsdcAfter = (await getAccount(provider.connection, policyholderUsdcAta)).amount;
    expect(Number(policyholderUsdcAfter - policyholderUsdcBefore)).to.equal(4_500_000_000);

    // Verify pool state reflects the payout
    const poolStateAfter = await liquidityPoolProgram.account.poolState.fetch(poolState);
    expect(poolStateAfter.totalClaimsPaid.toNumber()).to.equal(4_500_000_000);
  });

  // ── Test 6: Reject payout for already paid claim ───────────────────────────
  it("should reject payout for already paid claim", async () => {
    try {
      await claimsProcessorProgram.methods
        .executeClaimPayout({ usdc: {} })
        .accounts({
          claimsState: claimsState,
          claim: claimPda,
          policy: policyPda,
          poolState: poolState,
          poolVaultUsdc: poolVaultUsdc,
          poolVaultSol: poolVaultSol,
          claimantTokenAccount: policyholderUsdcAta,
          claimant: policyholder.publicKey,
          liquidityPoolProgram: LIQUIDITY_POOL_PROGRAM_ID,
          authority: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      expect.fail("Should have thrown an error for already paid claim");
    } catch (err: any) {
      expect(err).to.exist;
    }
  });

  // ── Test 7: Reject claim submission with 0 amount ──────────────────────────
  it("should reject claim submission with 0 amount", async () => {
    // We need a fresh policy for this test since the original policy's claim_count
    // may still be 0 in policy_manager (mark_policy_claimed not called).
    // However, claims_state.total_claims is now 1, so claim seed would use id=2.
    // But the original policy was already used. Let's create a second policy
    // for this negative test.

    // Create a second policy for the policyholder
    const stateNow = await policyManagerProgram.account.protocolState.fetch(protocolState);
    const [policyPda2] = derivePolicy(policyholder.publicKey, stateNow.totalPolicies.toNumber() + 1);

    await policyManagerProgram.methods
      .createPolicy(
        Array.from(Buffer.alloc(32, 0xdd)),
        new BN(5_000_000_000),
        new BN(250_000_000),
        500,
        { theftAndLoss: {} },
        { annual: {} },
        365,
      )
      .accounts({
        protocolState: protocolState,
        customer: customerPda,
        policy: policyPda2,
        payer: policyholder.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([policyholder])
      .rpc();

    // Pay premium on the second policy
    await policyManagerProgram.methods
      .payPremium(new BN(250_000_000))
      .accounts({
        protocolState: protocolState,
        policy: policyPda2,
        payerTokenAccount: policyholderUsdcAta,
        treasuryTokenAccount: vaultUsdc,
        poolVault: poolVaultUsdc,
        payer: policyholder.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([policyholder])
      .rpc();

    // Now try submitting a claim with 0 amount
    const csState = await claimsProcessorProgram.account.claimsState.fetch(claimsState);
    const [claimPda2] = deriveClaim(policyPda2, csState.totalClaims.toNumber() + 1);

    try {
      await claimsProcessorProgram.methods
        .submitClaim({ theft: {} }, Array.from(Buffer.alloc(32, 0xee)), new BN(0))
        .accounts({
          claimsState: claimsState,
          policy: policyPda2,
          claim: claimPda2,
          customer: policyholder.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([policyholder])
        .rpc();
      expect.fail("Should have thrown an error for 0 amount claim");
    } catch (err: any) {
      expect(err).to.exist;
    }
  });
});
