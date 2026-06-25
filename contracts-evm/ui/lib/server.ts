// SERVER-ONLY. Imported exclusively by app/api/** route handlers — never by a client
// component, so signing keys never reach the browser bundle.
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { spawn } from "node:child_process";
import path from "node:path";

import { RPC_URL, hashkeyTestnet } from "./config";

function requireKey(name: "PRIVATE_KEY" | "ALICE_KEY"): Hex {
  const v = process.env[name];
  if (!v) throw new Error(`Missing server env ${name}`);
  return v as Hex;
}

/** Wallet for the compliance operator / issuer (AGENT + ISSUER + SCORER roles). */
export function agentWallet() {
  const account = privateKeyToAccount(requireKey("PRIVATE_KEY"));
  return createWalletClient({ account, chain: hashkeyTestnet, transport: http(RPC_URL) });
}

/** Wallet for the demo payer "Alice". */
export function aliceWallet() {
  const account = privateKeyToAccount(requireKey("ALICE_KEY"));
  return createWalletClient({ account, chain: hashkeyTestnet, transport: http(RPC_URL) });
}

export function agentAddress() {
  return privateKeyToAccount(requireKey("PRIVATE_KEY")).address;
}

/** Run the off-chain AI-AML scorer and return its parsed RiskResult JSON. */
export interface RiskResult {
  address: string;
  score: number;
  band: "low" | "medium" | "high";
  reasons: string[];
  breakdown: { id: string; score: number; weight: number; contribution: number; reason: string }[];
  modelRef: Hex;
}

export function runScorer(address: string, counterparties: string[] = []): Promise<RiskResult> {
  const scorerDir = path.join(process.cwd(), "..", "scorer");
  const bin = path.join(scorerDir, "node_modules", ".bin", "tsx");
  const args = ["src/cli.ts", "score", address];
  for (const c of counterparties) args.push("--counterparty", c);
  args.push("--json");

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: scorerDir });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`scorer exited ${code}: ${err}`));
      try {
        resolve(JSON.parse(out.trim()) as RiskResult);
      } catch {
        reject(new Error(`scorer output not JSON: ${out.slice(0, 200)}`));
      }
    });
  });
}
