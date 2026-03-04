import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";

import {
  getSharedUsdcMint,
  createAndFundATA,
  airdropSol,
  derivePoolState,
  derivePoolVaultUsdc,
  derivePoolVaultSol,
  deriveLpTokenMint,
  deriveLpPosition,
} from "./setup";

describe("LP Provider Journey", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.LiquidityPool as Program;

  // PDAs
  const [poolStatePDA] = derivePoolState();
  const [poolVaultUsdcPDA] = derivePoolVaultUsdc();
  const [poolVaultSolPDA] = derivePoolVaultSol();
  const [lpTokenMintPDA] = deriveLpTokenMint();

  // Actors
  const admin = (provider.wallet as anchor.Wallet).payer;
  const lpProvider = Keypair.generate();

  // LP provider PDAs
  const [lpPositionPDA] = deriveLpPosition(lpProvider.publicKey);

  // Token accounts (set in before())
  let usdcMint: PublicKey;
  let lpProviderUsdcAta: PublicKey;
  let lpProviderLpTokenAta: PublicKey;

  before(async () => {
    // 1. Airdrop SOL to admin and lpProvider
    await airdropSol(provider.connection, admin.publicKey);
    await airdropSol(provider.connection, lpProvider.publicKey);

    // 2. Get shared USDC mint (programs already initialized by test 01)
    usdcMint = await getSharedUsdcMint(provider, admin);

    // 3. Create and fund lpProvider's USDC ATA with 100,000 USDC (6 decimals)
    lpProviderUsdcAta = await createAndFundATA(
      provider,
      usdcMint,
      lpProvider.publicKey,
      admin, // payer / mint authority
      100_000_000_000
    );

    // 5. Create lpProvider's LP token ATA
    lpProviderLpTokenAta = await getAssociatedTokenAddress(
      lpTokenMintPDA,
      lpProvider.publicKey
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Deposit 10,000 USDC and receive LP tokens
  // ──────────────────────────────────────────────────────────────────────────
  it("should deposit 10,000 USDC and receive LP tokens", async () => {
    const depositAmount = new BN(10_000_000_000); // 10,000 USDC (6 decimals)

    await program.methods
      .depositLpUsdc(depositAmount)
      .accounts({
        poolState: poolStatePDA,
        lpPosition: lpPositionPDA,
        poolVaultUsdc: poolVaultUsdcPDA,
        lpTokenMint: lpTokenMintPDA,
        depositorUsdc: lpProviderUsdcAta,
        depositorLpToken: lpProviderLpTokenAta,
        depositor: lpProvider.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([lpProvider])
      .rpc();

    // Verify pool_state.totalCapitalUsdc increased
    const poolState = await program.account.poolState.fetch(poolStatePDA);
    expect(poolState.totalCapitalUsdc.toNumber()).to.be.greaterThan(0);

    // Verify lp_position.lpTokens > 0 (first depositor gets 1:1 ratio)
    const lpPosition = await program.account.lpPosition.fetch(lpPositionPDA);
    expect(lpPosition.lpTokens.toNumber()).to.be.greaterThan(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Verify pool_state after USDC deposit
  // ──────────────────────────────────────────────────────────────────────────
  it("should update pool_state correctly after USDC deposit", async () => {
    const poolState = await program.account.poolState.fetch(poolStatePDA);

    expect(poolState.totalCapitalUsdc.toNumber()).to.equal(10_000_000_000);
    expect(poolState.totalLpSupply.toNumber()).to.be.greaterThan(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Deposit 5 SOL
  // ──────────────────────────────────────────────────────────────────────────
  it("should deposit 5 SOL", async () => {
    const depositAmount = new BN(5_000_000_000); // 5 SOL in lamports

    const poolStateBefore = await program.account.poolState.fetch(poolStatePDA);
    const solBefore = poolStateBefore.totalCapitalSol.toNumber();

    await program.methods
      .depositLpSol(depositAmount)
      .accounts({
        poolState: poolStatePDA,
        lpPosition: lpPositionPDA,
        poolVaultSol: poolVaultSolPDA,
        lpTokenMint: lpTokenMintPDA,
        depositorLpToken: lpProviderLpTokenAta,
        depositor: lpProvider.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([lpProvider])
      .rpc();

    // Verify pool_state.totalCapitalSol increased
    const poolStateAfter = await program.account.poolState.fetch(poolStatePDA);
    expect(poolStateAfter.totalCapitalSol.toNumber()).to.be.greaterThan(solBefore);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Reject deposit of 0 USDC
  // ──────────────────────────────────────────────────────────────────────────
  it("should reject deposit of 0 USDC", async () => {
    try {
      await program.methods
        .depositLpUsdc(new BN(0))
        .accounts({
          poolState: poolStatePDA,
          lpPosition: lpPositionPDA,
          poolVaultUsdc: poolVaultUsdcPDA,
          lpTokenMint: lpTokenMintPDA,
          depositorUsdc: lpProviderUsdcAta,
          depositorLpToken: lpProviderLpTokenAta,
          depositor: lpProvider.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([lpProvider])
        .rpc();

      expect.fail("Transaction should have failed for 0 deposit");
    } catch (err: any) {
      expect(err).to.exist;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Withdraw USDC by burning LP tokens
  // ──────────────────────────────────────────────────────────────────────────
  it("should withdraw USDC by burning LP tokens", async () => {
    // Check the lpProvider's current LP balance and USDC balance
    const lpPositionBefore = await program.account.lpPosition.fetch(lpPositionPDA);
    const lpTokensBefore = lpPositionBefore.lpTokens.toNumber();

    const poolStateBefore = await program.account.poolState.fetch(poolStatePDA);
    const totalCapitalUsdcBefore = poolStateBefore.totalCapitalUsdc.toNumber();

    const usdcAccountBefore = await getAccount(provider.connection, lpProviderUsdcAta);
    const usdcBalanceBefore = Number(usdcAccountBefore.amount);

    // Withdraw half of the LP tokens (burning them for USDC)
    const lpTokensToWithdraw = new BN(Math.floor(lpTokensBefore / 2));

    await program.methods
      .withdrawLpUsdc(lpTokensToWithdraw)
      .accounts({
        poolState: poolStatePDA,
        lpPosition: lpPositionPDA,
        poolVaultUsdc: poolVaultUsdcPDA,
        lpTokenMint: lpTokenMintPDA,
        withdrawerUsdc: lpProviderUsdcAta,
        withdrawerLpToken: lpProviderLpTokenAta,
        withdrawer: lpProvider.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([lpProvider])
      .rpc();

    // Verify pool_state.totalCapitalUsdc decreased
    const poolStateAfter = await program.account.poolState.fetch(poolStatePDA);
    expect(poolStateAfter.totalCapitalUsdc.toNumber()).to.be.lessThan(totalCapitalUsdcBefore);

    // Verify withdrawer received USDC (minus withdrawal fee)
    // SCR coverage ratio starts at 10000 (9001-11000 bracket) => 500 bps (5%) fee
    const usdcAccountAfter = await getAccount(provider.connection, lpProviderUsdcAta);
    const usdcBalanceAfter = Number(usdcAccountAfter.amount);
    expect(usdcBalanceAfter).to.be.greaterThan(usdcBalanceBefore);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: Reject withdrawal of 0 LP tokens
  // ──────────────────────────────────────────────────────────────────────────
  it("should reject withdrawal of 0 LP tokens", async () => {
    try {
      await program.methods
        .withdrawLpUsdc(new BN(0))
        .accounts({
          poolState: poolStatePDA,
          lpPosition: lpPositionPDA,
          poolVaultUsdc: poolVaultUsdcPDA,
          lpTokenMint: lpTokenMintPDA,
          withdrawerUsdc: lpProviderUsdcAta,
          withdrawerLpToken: lpProviderLpTokenAta,
          withdrawer: lpProvider.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([lpProvider])
        .rpc();

      expect.fail("Transaction should have failed for 0 LP token withdrawal");
    } catch (err: any) {
      expect(err).to.exist;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 7: Reject withdrawal exceeding LP token balance
  // ──────────────────────────────────────────────────────────────────────────
  it("should reject withdrawal exceeding LP token balance", async () => {
    const lpPosition = await program.account.lpPosition.fetch(lpPositionPDA);
    const excessiveAmount = new BN(lpPosition.lpTokens.toNumber() + 1_000_000_000);

    try {
      await program.methods
        .withdrawLpUsdc(excessiveAmount)
        .accounts({
          poolState: poolStatePDA,
          lpPosition: lpPositionPDA,
          poolVaultUsdc: poolVaultUsdcPDA,
          lpTokenMint: lpTokenMintPDA,
          withdrawerUsdc: lpProviderUsdcAta,
          withdrawerLpToken: lpProviderLpTokenAta,
          withdrawer: lpProvider.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([lpProvider])
        .rpc();

      expect.fail("Transaction should have failed for excessive withdrawal");
    } catch (err: any) {
      expect(err).to.exist;
    }
  });
});
