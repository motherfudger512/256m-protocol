import { http, createConfig } from "wagmi";
import { mainnet, hardhat } from "wagmi/chains";
import { type Address } from "viem";

// Contract addresses from environment or defaults (for local dev)
export const INSURANCE_MANAGER_ADDRESS = (process.env
  .NEXT_PUBLIC_ETH_INSURANCE_MANAGER_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;

export const LIQUIDITY_POOL_ADDRESS = (process.env
  .NEXT_PUBLIC_ETH_LIQUIDITY_POOL_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;

export const STABLECOIN_ADDRESS = (process.env
  .NEXT_PUBLIC_ETH_STABLECOIN_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;

// Chain selection based on env
const chainId = Number(process.env.NEXT_PUBLIC_ETH_CHAIN_ID || "1");
const isHardhat = chainId === 31337;

const rpcUrl =
  process.env.NEXT_PUBLIC_ETH_RPC_URL ||
  (isHardhat ? "http://127.0.0.1:8545" : undefined);

// Build config with both chains listed so types are satisfied.
// Only the active chain's transport will be used at runtime.
const defaultTransport = rpcUrl ? http(rpcUrl) : http();

export const wagmiConfig = createConfig({
  chains: [mainnet, hardhat],
  transports: {
    [mainnet.id]: defaultTransport,
    [hardhat.id]: defaultTransport,
  },
  ssr: true,
});

export const activeChain = isHardhat ? hardhat : mainnet;
