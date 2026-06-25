// SPDX-License-Identifier: Apache-2.0
import {
  createPublicClient,
  createWalletClient,
  http,
  publicActions,
  type Address as ViemAddress,
  type Hex as ViemHex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type { Address, ChainReader, Hex, SubmitAttestationParams } from "./types.js";

const AML_ORACLE_ABI = [
  {
    type: "function",
    name: "attestRisk",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "score", type: "uint8" },
      { name: "modelRef", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export function createChainReader(client: PublicClient<Transport>): ChainReader {
  return {
    async getTxCount(address: Address): Promise<number> {
      const nonce = await client.getTransactionCount({ address });
      return Number(nonce);
    },
    async hasCode(address: Address): Promise<boolean> {
      const code = await client.getCode({ address });
      return code !== undefined && code !== "0x";
    },
  };
}

export function createPublicChainClient(rpcUrl: string): PublicClient<Transport> {
  return createPublicClient({ transport: http(rpcUrl) });
}

export function createWalletChainClient(
  rpcUrl: string,
  privateKey: Hex,
): WalletClient<Transport, undefined, ReturnType<typeof privateKeyToAccount>> {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    transport: http(rpcUrl),
  }).extend(publicActions);
}

export async function submitAttestation(
  walletClient: WalletClient<Transport>,
  amlOracleAddress: Address,
  params: SubmitAttestationParams,
): Promise<Hex> {
  if (!walletClient.account) {
    throw new Error("Wallet client is missing an account.");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account,
    chain: undefined,
    address: amlOracleAddress as ViemAddress,
    abi: AML_ORACLE_ABI,
    functionName: "attestRisk",
    args: [params.account as ViemAddress, clampUint8(params.score), params.modelRef as ViemHex],
  });

  return hash as Hex;
}

function clampUint8(score: number): number {
  const rounded = Math.round(score);
  return Math.max(0, Math.min(100, rounded));
}
