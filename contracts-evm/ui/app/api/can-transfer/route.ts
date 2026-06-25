import { NextResponse } from "next/server";
import { parseUnits, type Address } from "viem";
import { publicClient } from "@/lib/chain";
import { modularComplianceAbi } from "@/lib/abis";
import { addresses } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { from, to, amount } = (await req.json()) as { from: Address; to: Address; amount: string };
    const [allowed, reason] = await publicClient.readContract({
      address: addresses.compliance,
      abi: modularComplianceAbi,
      functionName: "canTransfer",
      args: [from, to, parseUnits(amount || "0", 18)],
    });
    return NextResponse.json({ allowed, reason });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "canTransfer failed" }, { status: 500 });
  }
}
