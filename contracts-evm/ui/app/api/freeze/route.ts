import { NextResponse } from "next/server";
import type { Address } from "viem";
import { publicClient } from "@/lib/chain";
import { agentWallet } from "@/lib/server";
import { identityRegistryAbi } from "@/lib/abis";
import { addresses } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { address, frozen } = (await req.json()) as { address: Address; frozen: boolean };
    if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
    const wallet = agentWallet();
    const hash = await wallet.writeContract({
      address: addresses.registry,
      abi: identityRegistryAbi,
      functionName: "setAddressFrozen",
      args: [address, Boolean(frozen)],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return NextResponse.json({ error: "freeze transaction reverted", hash }, { status: 500 });
    }
    return NextResponse.json({ hash, frozen: Boolean(frozen) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "freeze failed" }, { status: 500 });
  }
}
