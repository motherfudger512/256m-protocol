import BN from "bn.js";

export function lamportsToSol(lamports: BN | number): string {
  const value = typeof lamports === "number" ? lamports : lamports.toNumber();
  return (value / 1e9).toFixed(4);
}

export function baseToUsdc(base: BN | number): string {
  const value = typeof base === "number" ? base : base.toNumber();
  return (value / 1e6).toFixed(2);
}

export function usdcToBase(usdc: number): BN {
  return new BN(Math.floor(usdc * 1e6));
}

export function solToLamports(sol: number): BN {
  return new BN(Math.floor(sol * 1e9));
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2);
}

export function formatTimestamp(timestamp: BN | number): string {
  const value = typeof timestamp === "number" ? timestamp : timestamp.toNumber();
  return new Date(value * 1000).toLocaleDateString();
}

export function getEnumVariant(enumObj: Record<string, unknown>): string {
  return Object.keys(enumObj)[0];
}
