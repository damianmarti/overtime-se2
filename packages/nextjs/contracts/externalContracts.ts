import { Abi } from "abitype";
import SportsAMMV2ABI from "~~/contracts/abis/SportsAMMV2.json";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

// Minimal ERC20 ABI for approve function
const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * @example
 * const externalContracts = {
 *   1: {
 *     DAI: {
 *       address: "0x...",
 *       abi: [...],
 *     },
 *   },
 * } as const;
 */
const externalContracts = {
  10: {
    SportsAMMV2: {
      address: "0xFb4e4811C7A811E098A556bD79B64c20b479E431",
      abi: SportsAMMV2ABI as Abi,
    },
    USDC: {
      address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
      abi: ERC20_ABI as Abi,
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
