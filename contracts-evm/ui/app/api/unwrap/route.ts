import { NextResponse } from "next/server";
import { parseUnits, maxUint256 } from "viem";
import { publicClient } from "@/lib/chain";
import { agentWallet, agentAddress } from "@/lib/server";
import { compliantTokenAbi, compliantWrapperAbi } from "@/lib/abis";
import { addresses } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { amount } = (await req.json()) as { amount: string };
    const value = parseUnits(amount || "0", 18);
    const wallet = agentWallet();
    const owner = agentAddress();

    // unwrap burns cUSDC via burnFrom -> ensure the wrapper has a cUSDC allowance.
    const allowance = await publicClient.readContract({
      address: addresses.token, abi: compliantTokenAbi, functionName: "allowance", args: [owner, addresses.wrapper],
    });
    if (allowance < value) {
      const approveHash = await wallet.writeContract({
        address: addresses.token, abi: compliantTokenAbi, functionName: "approve", args: [addresses.wrapper, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    const hash = await wallet.writeContract({
      address: addresses.wrapper, abi: compliantWrapperAbi, functionName: "unwrap", args: [value],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return NextResponse.json({ error: "unwrap transaction reverted", hash }, { status: 500 });
    }
    return NextResponse.json({ hash });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unwrap failed" }, { status: 500 });
  }
}
