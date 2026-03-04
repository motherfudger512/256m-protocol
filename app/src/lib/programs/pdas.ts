import { PublicKey } from "@solana/web3.js";
import { PROGRAM_IDS } from "./programIds";

// ── Liquidity Pool PDAs ─────────────────────────────────────────────────────

export function derivePoolState(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_state")],
    PROGRAM_IDS.liquidityPool,
  );
}

export function derivePoolVaultUsdc(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault_usdc")],
    PROGRAM_IDS.liquidityPool,
  );
}

export function derivePoolVaultSol(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault_sol")],
    PROGRAM_IDS.liquidityPool,
  );
}

export function deriveLpTokenMint(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lp_token_mint")],
    PROGRAM_IDS.liquidityPool,
  );
}

export function deriveLpPosition(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lp_position"), owner.toBuffer()],
    PROGRAM_IDS.liquidityPool,
  );
}

export function deriveInterestSnapshot(epoch: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(epoch));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("interest_snapshot"), buf],
    PROGRAM_IDS.liquidityPool,
  );
}

// ── Policy Manager PDAs ─────────────────────────────────────────────────────

export function deriveProtocolState(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_state")],
    PROGRAM_IDS.policyManager,
  );
}

export function deriveCustomer(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("customer"), owner.toBuffer()],
    PROGRAM_IDS.policyManager,
  );
}

export function derivePolicy(
  customerOwner: PublicKey,
  policyId: number,
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(policyId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), customerOwner.toBuffer(), buf],
    PROGRAM_IDS.policyManager,
  );
}

// ── Claims Processor PDAs ───────────────────────────────────────────────────

export function deriveClaimsState(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("claims_state")],
    PROGRAM_IDS.claimsProcessor,
  );
}

export function deriveClaim(
  policyKey: PublicKey,
  claimId: number,
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(claimId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("claim"), policyKey.toBuffer(), buf],
    PROGRAM_IDS.claimsProcessor,
  );
}

// ── Treasury PDAs ───────────────────────────────────────────────────────────

export function deriveTreasuryState(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_state")],
    PROGRAM_IDS.treasury,
  );
}

export function deriveTreasuryVaultUsdc(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_usdc")],
    PROGRAM_IDS.treasury,
  );
}

export function deriveTreasuryVaultSol(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_sol")],
    PROGRAM_IDS.treasury,
  );
}
