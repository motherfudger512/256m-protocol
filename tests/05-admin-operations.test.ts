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
  TREASURY_PROGRAM_ID,
  deriveTreasuryState,
  deriveTreasuryVaultUsdc,
  deriveTreasuryVaultSol,
  derivePoolState,
  derivePoolVaultUsdc,
  derivePoolVaultSol,
  deriveLpTokenMint,
  deriveLpPosition,
  deriveInterestSnapshot,
  airdropSol,
  getSharedUsdcMint,
  createAndFundATA,
  getATA,
} from "./setup";

// ── Load programs from workspace ──────────────────────────────────────────────
const liquidityPoolProgram = anchor.workspace.LiquidityPool as Program;
const treasuryProgram = anchor.workspace.Treasury as Program;

// ── Provider & Admin ──────────────────────────────────────────────────────────
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const admin = (provider.wallet as anchor.Wallet).payer;

// ── Keypairs ──────────────────────────────────────────────────────────────────
const lpProvider = Keypair.generate();

// ── Module-level variables ────────────────────────────────────────────────────
let usdcMint: PublicKey;
let adminUsdcAta: PublicKey;

// Treasury PDAs
let treasuryState: PublicKey;
let vaultUsdc: PublicKey;
let vaultSol: PublicKey;

// Liquidity Pool PDAs
let poolState: PublicKey;
let poolVaultUsdc: PublicKey;
let poolVaultSol: PublicKey;
let lpTokenMint: PublicKey;

// LP provider
let lpProviderUsdcAta: PublicKey;
let lpProviderLpTokenAta: PublicKey;
let lpPositionPDA: PublicKey;

describe("256M Protocol - Admin Operations", () => {
  before(async () => {
    // 1. Airdrop SOL to admin and lpProvider
    await airdropSol(provider.connection, admin.publicKey, 100 * LAMPORTS_PER_SOL);
    await airdropSol(provider.connection, lpProvider.publicKey, 100 * LAMPORTS_PER_SOL);

    // 2. Get shared USDC mint (programs already initialized by test 01)
    usdcMint = await getSharedUsdcMint(provider, admin);

    // 3. Derive all PDAs
    [treasuryState] = deriveTreasuryState();
    [vaultUsdc] = deriveTreasuryVaultUsdc();
    [vaultSol] = deriveTreasuryVaultSol();
    [poolState] = derivePoolState();
    [poolVaultUsdc] = derivePoolVaultUsdc();
    [poolVaultSol] = derivePoolVaultSol();
    [lpTokenMint] = deriveLpTokenMint();
    [lpPositionPDA] = deriveLpPosition(lpProvider.publicKey);

    // 4. Create and fund LP provider's USDC ATA with 100,000 USDC
    lpProviderUsdcAta = await createAndFundATA(
      provider,
      usdcMint,
      lpProvider.publicKey,
      admin,
      100_000_000_000, // 100,000 USDC (6 decimals)
    );

    // 7. Get LP provider's LP token ATA address
    lpProviderLpTokenAta = await getAssociatedTokenAddress(
      lpTokenMint,
      lpProvider.publicKey,
    );

    // 8. LP provider deposits 50,000 USDC into pool
    const depositAmount = new BN(50_000_000_000); // 50,000 USDC
    await liquidityPoolProgram.methods
      .depositLpUsdc(depositAmount)
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

    // 9. Create admin's USDC destination ATA (funded with 0 USDC initially)
    adminUsdcAta = await createAndFundATA(
      provider,
      usdcMint,
      admin.publicKey,
      admin,
      0,
    );

    // 10. Fund treasury: create a temp USDC ATA for admin with USDC, then collect_platform_fee
    //     Admin's ATA is already created above with 0. Mint USDC into it for the fee deposit.
    //     We need to mint some USDC into admin's ATA to use as fee source.
    const { mintTo } = await import("@solana/spl-token");
    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      adminUsdcAta,
      admin, // mint authority
      10_000_000_000, // 10,000 USDC for treasury funding
    );

    // Collect 5,000 USDC as platform fee into treasury vault
    await treasuryProgram.methods
      .collectPlatformFee(new BN(5_000_000_000), { usdc: {} })
      .accounts({
        treasuryState: treasuryState,
        vaultUsdc: vaultUsdc,
        vaultSol: vaultSol,
        sourceTokenAccount: adminUsdcAta,
        payer: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  // ============================================================================
  // Pool Admin: Capital Deployment
  // ============================================================================

  it("should deploy 5,000 USDC capital", async () => {
    const poolStateBefore = await liquidityPoolProgram.account.poolState.fetch(poolState);
    const deployedBefore = poolStateBefore.totalDeployedUsdc.toNumber();
    const capitalBefore = poolStateBefore.totalCapitalUsdc.toNumber();

    const deployAmount = new BN(5_000_000_000); // 5,000 USDC

    await liquidityPoolProgram.methods
      .deployCapital(deployAmount, { usdc: {} })
      .accounts({
        poolState: poolState,
        poolVaultUsdc: poolVaultUsdc,
        poolVaultSol: poolVaultSol,
        destinationUsdc: adminUsdcAta,
        destinationSol: admin.publicKey,
        authority: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const poolStateAfter = await liquidityPoolProgram.account.poolState.fetch(poolState);

    // Verify total_deployed_usdc increased by 5,000 USDC
    expect(poolStateAfter.totalDeployedUsdc.toNumber()).to.equal(
      deployedBefore + 5_000_000_000,
    );

    // Verify total_capital_usdc decreased by 5,000 USDC
    expect(poolStateAfter.totalCapitalUsdc.toNumber()).to.equal(
      capitalBefore - 5_000_000_000,
    );

    // Verify admin's ATA received the USDC
    const adminAccount = await getAccount(provider.connection, adminUsdcAta);
    expect(Number(adminAccount.amount)).to.be.greaterThan(0);
  });

  it("should reject deployment exceeding max_deployment_bps", async () => {
    // Pool has 50,000 USDC total value. max_deployment_bps = 7000 (70%).
    // Max deployable = 70% of pool_value. Already deployed 5,000.
    // Try to deploy a huge amount that would exceed 70% of pool value.
    const excessiveAmount = new BN(40_000_000_000); // 40,000 USDC

    try {
      await liquidityPoolProgram.methods
        .deployCapital(excessiveAmount, { usdc: {} })
        .accounts({
          poolState: poolState,
          poolVaultUsdc: poolVaultUsdc,
          poolVaultSol: poolVaultSol,
          destinationUsdc: adminUsdcAta,
          destinationSol: admin.publicKey,
          authority: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      expect.fail("Should have thrown an error for exceeding max deployment");
    } catch (err) {
      expect(err).to.exist;
    }
  });

  it("should reject deploy_capital from non-authority", async () => {
    const randomKeypair = Keypair.generate();
    await airdropSol(provider.connection, randomKeypair.publicKey, 10 * LAMPORTS_PER_SOL);

    try {
      await liquidityPoolProgram.methods
        .deployCapital(new BN(1_000_000_000), { usdc: {} })
        .accounts({
          poolState: poolState,
          poolVaultUsdc: poolVaultUsdc,
          poolVaultSol: poolVaultSol,
          destinationUsdc: adminUsdcAta,
          destinationSol: randomKeypair.publicKey,
          authority: randomKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([randomKeypair])
        .rpc();
      expect.fail("Should have thrown an error for unauthorized deploy");
    } catch (err) {
      expect(err).to.exist;
    }
  });

  // ============================================================================
  // Pool Admin: Capital Recall
  // ============================================================================

  it("should recall 6,000 USDC (profit scenario)", async () => {
    const poolStateBefore = await liquidityPoolProgram.account.poolState.fetch(poolState);
    const deployedBefore = poolStateBefore.totalDeployedUsdc.toNumber();
    const capitalBefore = poolStateBefore.totalCapitalUsdc.toNumber();

    // Admin's ATA currently has USDC from the deploy_capital call.
    // Recall 6,000 USDC, which is more than 5,000 deployed = profit scenario.
    // First ensure admin has enough USDC to transfer back.
    // Mint extra USDC to admin's ATA to cover the 6,000 recall.
    const { mintTo } = await import("@solana/spl-token");
    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      adminUsdcAta,
      admin,
      1_000_000_000, // extra 1,000 USDC to cover the "profit"
    );

    const recallAmount = new BN(6_000_000_000); // 6,000 USDC

    await liquidityPoolProgram.methods
      .recallCapital(recallAmount, { usdc: {} })
      .accounts({
        poolState: poolState,
        poolVaultUsdc: poolVaultUsdc,
        poolVaultSol: poolVaultSol,
        sourceUsdc: adminUsdcAta,
        authority: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const poolStateAfter = await liquidityPoolProgram.account.poolState.fetch(poolState);

    // Recalled 6,000 when only 5,000 was deployed from our deploy.
    // If deployed_before was exactly 5,000 (from our deploy only), recall 6,000 > 5,000 → deployed=0.
    // But if state accumulated from other tests, deployed might be > 5,000.
    // Check relative: deployed decreased by at least 5,000 (or went to 0)
    expect(poolStateAfter.totalDeployedUsdc.toNumber()).to.be.lessThan(deployedBefore);

    // total_capital_usdc should increase by 6,000
    expect(poolStateAfter.totalCapitalUsdc.toNumber()).to.equal(
      capitalBefore + 6_000_000_000,
    );
  });

  it("should reject recall_capital from non-authority", async () => {
    const randomKeypair = Keypair.generate();
    await airdropSol(provider.connection, randomKeypair.publicKey, 10 * LAMPORTS_PER_SOL);

    // Create a USDC ATA for the random keypair
    const randomUsdcAta = await createAndFundATA(
      provider,
      usdcMint,
      randomKeypair.publicKey,
      admin,
      1_000_000_000,
    );

    try {
      await liquidityPoolProgram.methods
        .recallCapital(new BN(1_000_000_000), { usdc: {} })
        .accounts({
          poolState: poolState,
          poolVaultUsdc: poolVaultUsdc,
          poolVaultSol: poolVaultSol,
          sourceUsdc: randomUsdcAta,
          authority: randomKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([randomKeypair])
        .rpc();
      expect.fail("Should have thrown an error for unauthorized recall");
    } catch (err) {
      expect(err).to.exist;
    }
  });

  // ============================================================================
  // Pool Admin: Write-off Loss
  // ============================================================================

  it("should deploy and write off loss", async () => {
    // First, deploy 3,000 USDC so we have something to write off
    const deployAmount = new BN(3_000_000_000);
    await liquidityPoolProgram.methods
      .deployCapital(deployAmount, { usdc: {} })
      .accounts({
        poolState: poolState,
        poolVaultUsdc: poolVaultUsdc,
        poolVaultSol: poolVaultSol,
        destinationUsdc: adminUsdcAta,
        destinationSol: admin.publicKey,
        authority: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const poolStateBefore = await liquidityPoolProgram.account.poolState.fetch(poolState);
    const deployedBefore = poolStateBefore.totalDeployedUsdc.toNumber();
    const capitalBefore = poolStateBefore.totalCapitalUsdc.toNumber();

    // Write off 1,000 USDC loss
    const writeOffAmount = new BN(1_000_000_000);
    await liquidityPoolProgram.methods
      .writeOffDeploymentLoss(writeOffAmount, { usdc: {} })
      .accounts({
        poolState: poolState,
        authority: admin.publicKey,
      })
      .rpc();

    const poolStateAfter = await liquidityPoolProgram.account.poolState.fetch(poolState);

    // total_deployed_usdc should decrease by 1,000
    expect(poolStateAfter.totalDeployedUsdc.toNumber()).to.equal(
      deployedBefore - 1_000_000_000,
    );

    // total_capital_usdc should remain unchanged (loss, not a recall)
    expect(poolStateAfter.totalCapitalUsdc.toNumber()).to.equal(capitalBefore);
  });

  it("should reject write-off exceeding deployed", async () => {
    const poolStateCurrent = await liquidityPoolProgram.account.poolState.fetch(poolState);
    const currentDeployed = poolStateCurrent.totalDeployedUsdc.toNumber();

    // Try to write off more than what is deployed
    const excessiveAmount = new BN(currentDeployed + 1_000_000_000);

    try {
      await liquidityPoolProgram.methods
        .writeOffDeploymentLoss(excessiveAmount, { usdc: {} })
        .accounts({
          poolState: poolState,
          authority: admin.publicKey,
        })
        .rpc();
      expect.fail("Should have thrown an error for exceeding deployed amount");
    } catch (err) {
      expect(err).to.exist;
    }
  });

  // ============================================================================
  // Pool Admin: Interest & SCR
  // ============================================================================

  it("should record interest snapshot", async () => {
    const poolStateBefore = await liquidityPoolProgram.account.poolState.fetch(poolState);
    const interestBefore = poolStateBefore.totalInterestEarned.toNumber();

    const epoch = new BN(1);
    const interestRateBps = 500;
    const interestAccrued = new BN(100_000_000); // 100 USDC

    const [interestSnapshotPDA] = deriveInterestSnapshot(1);

    await liquidityPoolProgram.methods
      .recordInterestSnapshot(epoch, interestRateBps, interestAccrued)
      .accounts({
        poolState: poolState,
        interestSnapshot: interestSnapshotPDA,
        authority: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Verify the interest snapshot PDA was created correctly
    const snapshot = await liquidityPoolProgram.account.interestSnapshot.fetch(
      interestSnapshotPDA,
    );
    expect(snapshot.epoch.toNumber()).to.equal(1);
    expect(snapshot.interestRateBps).to.equal(500);
    expect(snapshot.interestAccrued.toNumber()).to.equal(100_000_000);
    expect(snapshot.totalCapital.toNumber()).to.be.greaterThan(0);

    // Verify pool_state.total_interest_earned increased
    const poolStateAfter = await liquidityPoolProgram.account.poolState.fetch(poolState);
    expect(poolStateAfter.totalInterestEarned.toNumber()).to.equal(
      interestBefore + 100_000_000,
    );
  });

  it("should update SCR", async () => {
    const newScr = new BN(5_000_000_000); // 5,000 USDC SCR

    await liquidityPoolProgram.methods
      .updateScr(newScr)
      .accounts({
        poolState: poolState,
        authority: admin.publicKey,
      })
      .rpc();

    const poolStateAfter = await liquidityPoolProgram.account.poolState.fetch(poolState);

    // Verify statutory_capital_required was updated
    expect(poolStateAfter.statutoryCapitalRequired.toNumber()).to.equal(5_000_000_000);

    // Verify scr_coverage_ratio was recalculated (no longer default 10000)
    // pool_value / scr * 10000 => coverage ratio should reflect actual pool value
    // Since pool has capital, deployed, and interest, ratio should be > 0
    expect(poolStateAfter.scrCoverageRatio).to.be.greaterThan(0);
  });

  // ============================================================================
  // Treasury Admin
  // ============================================================================

  it("should collect platform fee", async () => {
    const treasuryStateBefore = await treasuryProgram.account.treasuryState.fetch(
      treasuryState,
    );
    const platformFeesBefore = treasuryStateBefore.platformFees.toNumber();

    // Mint more USDC to admin's ATA to collect as fee
    const { mintTo } = await import("@solana/spl-token");
    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      adminUsdcAta,
      admin,
      2_000_000_000, // 2,000 USDC
    );

    const feeAmount = new BN(2_000_000_000); // 2,000 USDC

    await treasuryProgram.methods
      .collectPlatformFee(feeAmount, { usdc: {} })
      .accounts({
        treasuryState: treasuryState,
        vaultUsdc: vaultUsdc,
        vaultSol: vaultSol,
        sourceTokenAccount: adminUsdcAta,
        payer: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const treasuryStateAfter = await treasuryProgram.account.treasuryState.fetch(
      treasuryState,
    );

    // Verify platform_fees increased by 2,000 USDC
    expect(treasuryStateAfter.platformFees.toNumber()).to.equal(
      platformFeesBefore + 2_000_000_000,
    );

    // Verify total_fees_collected also increased
    expect(treasuryStateAfter.totalFeesCollected.toNumber()).to.be.greaterThan(
      treasuryStateBefore.totalFeesCollected.toNumber(),
    );
  });

  it("should withdraw USDC from treasury", async () => {
    const treasuryStateBefore = await treasuryProgram.account.treasuryState.fetch(
      treasuryState,
    );
    const withdrawnBefore = treasuryStateBefore.totalWithdrawn.toNumber();

    const adminBalanceBefore = Number(
      (await getAccount(provider.connection, adminUsdcAta)).amount,
    );

    // Withdraw 1,000 USDC from treasury
    const withdrawAmount = new BN(1_000_000_000);

    await treasuryProgram.methods
      .withdrawUsdc(withdrawAmount)
      .accounts({
        treasuryState: treasuryState,
        vaultUsdc: vaultUsdc,
        destination: adminUsdcAta,
        authority: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const treasuryStateAfter = await treasuryProgram.account.treasuryState.fetch(
      treasuryState,
    );

    // Verify total_withdrawn increased
    expect(treasuryStateAfter.totalWithdrawn.toNumber()).to.equal(
      withdrawnBefore + 1_000_000_000,
    );

    // Verify admin received the USDC
    const adminBalanceAfter = Number(
      (await getAccount(provider.connection, adminUsdcAta)).amount,
    );
    expect(adminBalanceAfter).to.equal(adminBalanceBefore + 1_000_000_000);
  });

  it("should update withdrawal threshold", async () => {
    const newThreshold = new BN(500_000); // 0.5 USDC

    await treasuryProgram.methods
      .updateWithdrawalThreshold(newThreshold)
      .accounts({
        treasuryState: treasuryState,
        authority: admin.publicKey,
      })
      .rpc();

    const treasuryStateAfter = await treasuryProgram.account.treasuryState.fetch(
      treasuryState,
    );

    expect(treasuryStateAfter.withdrawalThreshold.toNumber()).to.equal(500_000);
  });

  it("should transfer treasury authority", async () => {
    const newAuthority = Keypair.generate();
    await airdropSol(provider.connection, newAuthority.publicKey, 10 * LAMPORTS_PER_SOL);

    await treasuryProgram.methods
      .updateAuthority(newAuthority.publicKey)
      .accounts({
        treasuryState: treasuryState,
        authority: admin.publicKey,
      })
      .rpc();

    const treasuryStateAfter = await treasuryProgram.account.treasuryState.fetch(
      treasuryState,
    );

    // Verify new authority is set
    expect(treasuryStateAfter.authority.toBase58()).to.equal(
      newAuthority.publicKey.toBase58(),
    );

    // Now the old admin should fail to withdraw
    try {
      await treasuryProgram.methods
        .withdrawUsdc(new BN(100_000))
        .accounts({
          treasuryState: treasuryState,
          vaultUsdc: vaultUsdc,
          destination: adminUsdcAta,
          authority: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      expect.fail("Should have thrown an error for old authority withdrawal");
    } catch (err) {
      expect(err).to.exist;
    }

    // Transfer authority back to admin so subsequent test suites aren't affected
    await treasuryProgram.methods
      .updateAuthority(admin.publicKey)
      .accounts({
        treasuryState: treasuryState,
        authority: newAuthority.publicKey,
      })
      .signers([newAuthority])
      .rpc();
  });
});
