import { NextResponse } from "next/server";
import type { Address } from "viem";
import { publicClient } from "@/lib/chain";
import { agentWallet, runScorer } from "@/lib/server";
import { amlOracleAbi } from "@/lib/abis";
import { addresses } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { address, counterparties } = (await req.json()) as {
      address: Address;
      counterparties?: string[];
    };
    if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

    const risk = await runScorer(address, counterparties ?? []);
    const wallet = agentWallet();
    const hash = await wallet.writeContract({
      address: addresses.aml,
      abi: amlOracleAbi,
      functionName: "attestRisk",
      args: [address, risk.score, risk.modelRef],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return NextResponse.json({ error: "attest transaction reverted", hash }, { status: 500 });
    }
    return NextResponse.json({ hash, score: risk.score, band: risk.band, modelRef: risk.modelRef });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "attest failed" }, { status: 500 });
  }
}
