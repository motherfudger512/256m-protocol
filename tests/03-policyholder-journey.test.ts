import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAccount } from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";

import {
  LIQUIDITY_POOL_PROGRAM_ID,
  TREASURY_PROGRAM_ID,
  deriveTreasuryState,
  deriveTreasuryVaultUsdc,
  deriveTreasuryVaultSol,
  derivePoolState,
  derivePoolVaultUsdc,
  derivePoolVaultSol,
  deriveLpTokenMint,
  deriveProtocolState,
  deriveCustomer,
  derivePolicy,
  airdropSol,
  getSharedUsdcMint,
  createAndFundATA,
} from "./setup";

// ── Load programs from workspace ──────────────────────────────────────────────
const policyManagerProgram = anchor.workspace.PolicyManager as Program;
const liquidityPoolProgram = anchor.workspace.LiquidityPool as Program;
const treasuryProgram = anchor.workspace.Treasury as Program;

// ── Provider & Admin ──────────────────────────────────────────────────────────
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const admin = (provider.wallet as anchor.Wallet).payer;

// ── Keypairs ──────────────────────────────────────────────────────────────────
const policyholder = Keypair.generate();

// ── Module-level variables ────────────────────────────────────────────────────
let usdcMint: PublicKey;
let policyholderUsdcAta: PublicKey;

// Treasury PDAs
let treasuryState: PublicKey;
let vaultUsdc: PublicKey;
let vaultSol: PublicKey;

// Liquidity Pool PDAs
let poolState: PublicKey;
let poolVaultUsdc: PublicKey;
let poolVaultSol: PublicKey;
let lpTokenMint: PublicKey;

// Policy Manager PDAs
let protocolState: PublicKey;

// Customer & Policy PDAs
let customerPda: PublicKey;
let policyPda: PublicKey;

describe("256M Protocol - Policyholder Journey", () => {
  before(async () => {
    // 1. Airdrop SOL to admin and policyholder
    await airdropSol(provider.connection, admin.publicKey, 100 * LAMPORTS_PER_SOL);
    await airdropSol(provider.connection, policyholder.publicKey, 100 * LAMPORTS_PER_SOL);

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

    // Policy Manager
    [protocolState] = deriveProtocolState();

    // Customer PDA
    [customerPda] = deriveCustomer(policyholder.publicKey);

    // 3. Create and fund policyholder's USDC ATA with 50,000 USDC (50_000_000_000 base units)
    policyholderUsdcAta = await createAndFundATA(
      provider,
      usdcMint,
      policyholder.publicKey,
      admin,
      50_000_000_000,
    );
  });

  // ── 1. Register a customer ──────────────────────────────────────────────────
  it("should register a customer", async () => {
    const kycHash = Array.from(Buffer.alloc(32, 0xab));

    await policyManagerProgram.methods
      .registerCustomer(Array.from(kycHash))
      .accounts({
        customer: customerPda,
        owner: policyholder.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([policyholder])
      .rpc();

    const customer = await policyManagerProgram.account.customer.fetch(customerPda);

    expect(customer.owner.toBase58()).to.equal(policyholder.publicKey.toBase58());
    expect(customer.kycVerified).to.equal(false);
  });

  // ── 2. Verify customer KYC ─────────────────────────────────────────────────
  it("should verify customer KYC", async () => {
    await policyManagerProgram.methods
      .verifyCustomer()
      .accounts({
        protocolState: protocolState,
        customer: customerPda,
        authority: admin.publicKey,
      })
      .rpc();

    const customer = await policyManagerProgram.account.customer.fetch(customerPda);

    expect(customer.kycVerified).to.equal(true);
  });

  // ── 3. Reject verification from non-authority ──────────────────────────────
  it("should reject verification from non-authority", async () => {
    const randomKeypair = Keypair.generate();
    await airdropSol(provider.connection, randomKeypair.publicKey, 10 * LAMPORTS_PER_SOL);

    try {
      await policyManagerProgram.methods
        .verifyCustomer()
        .accounts({
          protocolState: protocolState,
          customer: customerPda,
          authority: randomKeypair.publicKey,
        })
        .signers([randomKeypair])
        .rpc();
      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err).to.exist;
    }
  });

  // ── 4. Create a policy ─────────────────────────────────────────────────────
  it("should create a policy", async () => {
    // Query current total_policies to derive correct PDA seed
    const currentState = await policyManagerProgram.account.protocolState.fetch(protocolState);
    const nextPolicyId = currentState.totalPolicies.toNumber() + 1;
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

    // Fetch and verify policy
    const policy = await policyManagerProgram.account.policy.fetch(policyPda);

    expect(policy.policyId.toNumber()).to.equal(1);
    expect(policy.customer.toBase58()).to.equal(policyholder.publicKey.toBase58());
    expect(policy.insuredValue.toNumber()).to.equal(10_000_000_000);
    expect(policy.premium.toNumber()).to.equal(500_000_000);
    expect(policy.deductibleBps).to.equal(1000);
    expect(JSON.stringify(policy.coverageType)).to.equal(JSON.stringify({ theftAndLoss: {} }));
    expect(JSON.stringify(policy.paymentFrequency)).to.equal(JSON.stringify({ annual: {} }));
    expect(JSON.stringify(policy.status)).to.equal(JSON.stringify({ active: {} }));
    expect(policy.totalPaid.toNumber()).to.equal(0);
    expect(policy.claimCount).to.equal(0);

    // Verify protocol state was updated
    const state = await policyManagerProgram.account.protocolState.fetch(protocolState);
    expect(state.totalPolicies.toNumber()).to.equal(1);
    expect(state.activePolicies.toNumber()).to.equal(1);
  });

  // ── 5. Reject policy for unverified customer ──────────────────────────────
  it("should reject policy for unverified customer", async () => {
    const unverifiedKeypair = Keypair.generate();
    await airdropSol(provider.connection, unverifiedKeypair.publicKey, 10 * LAMPORTS_PER_SOL);

    // Register new customer but do NOT verify KYC
    const [unverifiedCustomerPda] = deriveCustomer(unverifiedKeypair.publicKey);
    const kycHash = Array.from(Buffer.alloc(32, 0xcc));

    await policyManagerProgram.methods
      .registerCustomer(kycHash)
      .accounts({
        customer: unverifiedCustomerPda,
        owner: unverifiedKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([unverifiedKeypair])
      .rpc();

    // Attempt to create a policy without KYC verification
    const stateNow = await policyManagerProgram.account.protocolState.fetch(protocolState);
    const [unverifiedPolicyPda] = derivePolicy(unverifiedKeypair.publicKey, stateNow.totalPolicies.toNumber() + 1);

    try {
      await policyManagerProgram.methods
        .createPolicy(
          Array.from(Buffer.alloc(32, 0xdd)),
          new BN(5_000_000_000),
          new BN(250_000_000),
          500,
          { theftOnly: {} },
          { monthly: {} },
          180,
        )
        .accounts({
          protocolState: protocolState,
          customer: unverifiedCustomerPda,
          policy: unverifiedPolicyPda,
          payer: unverifiedKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([unverifiedKeypair])
        .rpc();
      expect.fail("Should have thrown an error for unverified customer");
    } catch (err) {
      expect(err).to.exist;
    }
  });

  // ── 6. Pay premium ────────────────────────────────────────────────────────
  it("should pay premium", async () => {
    const paymentAmount = new BN(500_000_000);

    // Get balances before payment
    const payerBalanceBefore = (await getAccount(provider.connection, policyholderUsdcAta)).amount;

    // Get treasury vault USDC balance before
    const treasuryVaultBefore = (await getAccount(provider.connection, vaultUsdc)).amount;

    // Get pool vault USDC balance before
    const poolVaultBefore = (await getAccount(provider.connection, poolVaultUsdc)).amount;

    await policyManagerProgram.methods
      .payPremium(paymentAmount)
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

    // Get balances after payment
    const payerBalanceAfter = (await getAccount(provider.connection, policyholderUsdcAta)).amount;
    const treasuryVaultAfter = (await getAccount(provider.connection, vaultUsdc)).amount;
    const poolVaultAfter = (await getAccount(provider.connection, poolVaultUsdc)).amount;

    // Verify payer balance decreased by the full payment amount
    expect(Number(payerBalanceBefore - payerBalanceAfter)).to.equal(500_000_000);

    // Platform fee = 500bps = 5% of 500_000_000 = 25_000_000
    const expectedPlatformFee = 25_000_000;
    const expectedPoolAmount = 475_000_000;

    // Verify treasury vault received the platform fee
    expect(Number(treasuryVaultAfter - treasuryVaultBefore)).to.equal(expectedPlatformFee);

    // Verify pool vault received the remainder
    expect(Number(poolVaultAfter - poolVaultBefore)).to.equal(expectedPoolAmount);

    // Verify policy total_paid was updated
    const policy = await policyManagerProgram.account.policy.fetch(policyPda);
    expect(policy.totalPaid.toNumber()).to.equal(500_000_000);
  });

  // ── 7. Reject premium payment of 0 ───────────────────────────────────────
  it("should reject premium payment of 0", async () => {
    try {
      await policyManagerProgram.methods
        .payPremium(new BN(0))
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
      expect.fail("Should have thrown an error for zero payment");
    } catch (err) {
      expect(err).to.exist;
    }
  });

  // ── 8. Cancel policy ──────────────────────────────────────────────────────
  it("should cancel policy", async () => {
    // Get active policies count before cancellation
    const stateBefore = await policyManagerProgram.account.protocolState.fetch(protocolState);
    const activeBefore = stateBefore.activePolicies.toNumber();

    await policyManagerProgram.methods
      .cancelPolicy()
      .accounts({
        protocolState: protocolState,
        customer: customerPda,
        policy: policyPda,
        signer: policyholder.publicKey,
      })
      .signers([policyholder])
      .rpc();

    // Verify policy status is Cancelled
    const policy = await policyManagerProgram.account.policy.fetch(policyPda);
    expect(JSON.stringify(policy.status)).to.equal(JSON.stringify({ cancelled: {} }));

    // Verify active_policies decreased
    const stateAfter = await policyManagerProgram.account.protocolState.fetch(protocolState);
    expect(stateAfter.activePolicies.toNumber()).to.equal(activeBefore - 1);
  });
});
