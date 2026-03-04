import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

// ── Program IDs ──────────────────────────────────────────────────────────────
export const LIQUIDITY_POOL_PROGRAM_ID = new PublicKey("FTmjzse3pxVhqGUEVKPRsyWvRmPwnAGQHVLgBmVbbGCG");
export const CLAIMS_PROCESSOR_PROGRAM_ID = new PublicKey("7fHLi8GsPqT4dbEjezKc4KaxWQ34kNv4vi8rwDwWxL4g");
export const POLICY_MANAGER_PROGRAM_ID = new PublicKey("BRNje37d7CY7tejLxQdVe8HN7eXQptoD42RqwA3awGFk");
export const TREASURY_PROGRAM_ID = new PublicKey("51qzEEND9HEHD8LUHxvv8Mz2ZgTrUEjbLeigr933nr6v");

// ── PDA Derivation ───────────────────────────────────────────────────────────

// Liquidity Pool PDAs
export function derivePoolState() {
  return PublicKey.findProgramAddressSync([Buffer.from("pool_state")], LIQUIDITY_POOL_PROGRAM_ID);
}

export function derivePoolVaultUsdc() {
  return PublicKey.findProgramAddressSync([Buffer.from("pool_vault_usdc")], LIQUIDITY_POOL_PROGRAM_ID);
}

export function derivePoolVaultSol() {
  return PublicKey.findProgramAddressSync([Buffer.from("pool_vault_sol")], LIQUIDITY_POOL_PROGRAM_ID);
}

export function deriveLpTokenMint() {
  return PublicKey.findProgramAddressSync([Buffer.from("lp_token_mint")], LIQUIDITY_POOL_PROGRAM_ID);
}

export function deriveLpPosition(owner: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lp_position"), owner.toBuffer()],
    LIQUIDITY_POOL_PROGRAM_ID,
  );
}

export function deriveInterestSnapshot(epoch: number) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(epoch));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("interest_snapshot"), buf],
    LIQUIDITY_POOL_PROGRAM_ID,
  );
}

// Claims Processor PDAs
export function deriveClaimsState() {
  return PublicKey.findProgramAddressSync([Buffer.from("claims_state")], CLAIMS_PROCESSOR_PROGRAM_ID);
}

export function deriveClaim(policyKey: PublicKey, claimId: number) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(claimId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("claim"), policyKey.toBuffer(), buf],
    CLAIMS_PROCESSOR_PROGRAM_ID,
  );
}

// Policy Manager PDAs
export function deriveProtocolState() {
  return PublicKey.findProgramAddressSync([Buffer.from("protocol_state")], POLICY_MANAGER_PROGRAM_ID);
}

export function deriveCustomer(owner: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("customer"), owner.toBuffer()],
    POLICY_MANAGER_PROGRAM_ID,
  );
}

export function derivePolicy(customerOwner: PublicKey, policyId: number) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(policyId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), customerOwner.toBuffer(), buf],
    POLICY_MANAGER_PROGRAM_ID,
  );
}

// Treasury PDAs
export function deriveTreasuryState() {
  return PublicKey.findProgramAddressSync([Buffer.from("treasury_state")], TREASURY_PROGRAM_ID);
}

export function deriveTreasuryVaultUsdc() {
  return PublicKey.findProgramAddressSync([Buffer.from("vault_usdc")], TREASURY_PROGRAM_ID);
}

export function deriveTreasuryVaultSol() {
  return PublicKey.findProgramAddressSync([Buffer.from("vault_sol")], TREASURY_PROGRAM_ID);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export async function airdropSol(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  amount: number = 100 * LAMPORTS_PER_SOL,
) {
  const sig = await connection.requestAirdrop(pubkey, amount);
  await connection.confirmTransaction(sig, "confirmed");
}

export async function createMockUSDCMint(
  provider: anchor.AnchorProvider,
  authority: Keypair,
): Promise<PublicKey> {
  return createMint(
    provider.connection,
    authority,
    authority.publicKey,
    null,
    6, // USDC has 6 decimals
  );
}

export async function createAndFundATA(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  owner: PublicKey,
  payer: Keypair,
  amount: number,
): Promise<PublicKey> {
  const ata = await createAssociatedTokenAccount(
    provider.connection,
    payer,
    mint,
    owner,
  );
  if (amount > 0) {
    await mintTo(
      provider.connection,
      payer,
      mint,
      ata,
      payer, // mint authority
      amount,
    );
  }
  return ata;
}

export async function getATA(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
  return getAssociatedTokenAddress(mint, owner);
}

// ── Shared Oracle Keypair ────────────────────────────────────────────────────
// All test files must use the same oracle since claims_state stores the oracle
// pubkey at initialization and cannot be changed afterwards.
export const SHARED_ORACLE = Keypair.generate();

// ── Shared USDC Mint Singleton ──────────────────────────────────────────────
// All test files run on the same validator, so they must share the same USDC
// mint (vaults are bound to it at initialization time).
let _cachedUsdcMint: PublicKey | null = null;

export async function getSharedUsdcMint(
  provider: anchor.AnchorProvider,
  authority: Keypair,
): Promise<PublicKey> {
  if (!_cachedUsdcMint) {
    _cachedUsdcMint = await createMockUSDCMint(provider, authority);
  }
  return _cachedUsdcMint;
}
