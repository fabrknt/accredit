#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { getAddress } from "viem";

import { createChainReader, createPublicChainClient, createWalletChainClient, submitAttestation } from "./chain.js";
import { featureContribution, score } from "./model.js";
import type { Address, Hex } from "./types.js";
import watchlistData from "./watchlist.json" with { type: "json" };

interface CliOptions {
  submit: boolean;
  json: boolean;
  counterparties: Address[];
  address: Address;
  txCount?: number;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const args = [...argv];
  const command = args.shift();

  if (command !== "score") {
    throw new Error('Usage: aml-score score <address> [--counterparty <address>] [--submit] [--json]');
  }

  const addressArg = args.shift();
  if (!addressArg) {
    throw new Error("Missing address argument.");
  }

  const counterparties: Address[] = [];
  let submit = false;
  let json = false;
  let txCount: number | undefined;

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--submit") {
      submit = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--tx-count") {
      const value = args.shift();
      if (value === undefined) {
        throw new Error("Missing value after --tx-count.");
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("Invalid --tx-count value.");
      }
      txCount = Math.floor(parsed);
      continue;
    }

    if (arg === "--counterparty") {
      const value = args.shift();
      if (!value) {
        throw new Error("Missing address after --counterparty.");
      }

      counterparties.push(normalizeAddress(value));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    submit,
    json,
    counterparties,
    address: normalizeAddress(addressArg),
    txCount,
  };
}

function normalizeAddress(value: string): Address {
  return getAddress(value).toLowerCase() as Address;
}

function loadWatchlist(): Set<Address> {
  return new Set(watchlistData.map((entry) => normalizeAddress(entry)));
}

function requireEnv(name: "RPC_URL" | "AML_ORACLE_ADDRESS" | "SCORER_PRIVATE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }

  return value;
}

function printResult(result: Awaited<ReturnType<typeof score>>): void {
  console.log(`Address:   ${result.address}`);
  console.log(`Score:     ${result.score}`);
  console.log(`Band:      ${result.band}`);
  console.log(`Model Ref: ${result.modelRef}`);
  console.log("");
  console.log("Breakdown:");

  for (const feature of result.breakdown) {
    console.log(
      `- ${feature.id}: raw=${feature.score} weight=${feature.weight} contribution=${featureContribution(feature)} :: ${feature.reason}`,
    );
  }

  console.log("");
  console.log("Reasons:");
  if (result.reasons.length === 0) {
    console.log("- No risk features fired.");
    return;
  }

  for (const reason of result.reasons) {
    console.log(`- ${reason}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const rpcUrl = process.env.RPC_URL;
  const publicClient = rpcUrl ? createPublicChainClient(rpcUrl) : undefined;
  const result = await score({
    address: options.address,
    counterparties: options.counterparties,
    watchlist: loadWatchlist(),
    chain: publicClient ? createChainReader(publicClient) : undefined,
    signals: options.txCount !== undefined ? { txCount: options.txCount } : undefined,
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    printResult(result);
  }

  if (!options.submit) {
    if (!options.json) {
      console.log("");
      console.log("Dry run only. Pass --submit to send attestRisk.");
    }
    return;
  }

  const walletClient = createWalletChainClient(
    requireEnv("RPC_URL"),
    requireEnv("SCORER_PRIVATE_KEY") as Hex,
  );
  const txHash = await submitAttestation(walletClient, normalizeAddress(requireEnv("AML_ORACLE_ADDRESS")), {
    account: result.address,
    score: result.score,
    modelRef: result.modelRef,
  });

  if (!options.json) {
    console.log("");
    console.log(`Submitted attestRisk tx: ${txHash}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
