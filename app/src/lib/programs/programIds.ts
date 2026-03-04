import { PublicKey } from "@solana/web3.js";

export const PROGRAM_IDS = {
  liquidityPool: new PublicKey("FTmjzse3pxVhqGUEVKPRsyWvRmPwnAGQHVLgBmVbbGCG"),
  policyManager: new PublicKey("BRNje37d7CY7tejLxQdVe8HN7eXQptoD42RqwA3awGFk"),
  claimsProcessor: new PublicKey("7fHLi8GsPqT4dbEjezKc4KaxWQ34kNv4vi8rwDwWxL4g"),
  treasury: new PublicKey("51qzEEND9HEHD8LUHxvv8Mz2ZgTrUEjbLeigr933nr6v"),
} as const;
