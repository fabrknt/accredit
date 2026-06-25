import { NextResponse } from "next/server";
import type { Address } from "viem";
import { publicClient } from "@/lib/chain";
import { agentWallet, runScorer } from "@/lib/server";
import { identityRegistryAbi, amlOracleAbi } from "@/lib/abis";
import { addresses } from "@/lib/config";

export const runtime = "nodejs";

// Onboard a participant: KYC-register, then run the initial AML screen and anchor it.
export async function POST(req: Request) {
  try {
    const { address, kycLevel, jurisdiction } = (await req.json()) as {
      address: Address;
      kycLevel?: number;
      jurisdiction?: number;
    };
    if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

    const wallet = agentWallet();
    const level = kycLevel && kycLevel > 0 ? kycLevel : 2;
    const country = jurisdiction ?? 392; // default JP

    // 1) KYC register.
    const regHash = await wallet.writeContract({
      address: addresses.registry,
      abi: identityRegistryAbi,
      functionName: "registerIdentity",
      args: [address, level, country, 0n],
    });
    const regReceipt = await publicClient.waitForTransactionReceipt({ hash: regHash });
    if (regReceipt.status !== "success") {
      return NextResponse.json({ error: "registerIdentity reverted", hash: regHash }, { status: 500 });
    }

    // 2) Initial AML screen + anchor.
    const risk = await runScorer(address);
    const amlHash = await wallet.writeContract({
      address: addresses.aml,
      abi: amlOracleAbi,
      functionName: "attestRisk",
      args: [address, risk.score, risk.modelRef],
    });
    const amlReceipt = await publicClient.waitForTransactionReceipt({ hash: amlHash });
    if (amlReceipt.status !== "success") {
      return NextResponse.json({ error: "attestRisk reverted", regHash, hash: amlHash }, { status: 500 });
    }

    return NextResponse.json({ regHash, amlHash, score: risk.score, band: risk.band });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "onboard failed" }, { status: 500 });
  }
}
