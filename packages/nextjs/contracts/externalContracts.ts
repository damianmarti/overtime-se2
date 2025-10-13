import { Abi } from "abitype";
import SportsAMMV2ABI from "~~/contracts/abis/SportsAMMV2.json";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

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
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
