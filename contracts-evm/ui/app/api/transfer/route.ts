import { NextResponse } from "next/server";
import { parseUnits, BaseError, ContractFunctionRevertedError, type Address } from "viem";
import { publicClient } from "@/lib/chain";
import { aliceWallet } from "@/lib/server";
import { compliantTokenAbi } from "@/lib/abis";
import { addresses } from "@/lib/config";

export const runtime = "nodejs";

function revertReason(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      return revert.reason ?? revert.shortMessage;
    }
    return e.shortMessage;
  }
  return e instanceof Error ? e.message.split("\n")[0] : String(e);
}

export async function POST(req: Request) {
  try {
    const { to, amount } = (await req.json()) as { to: Address; amount: string };
    const wallet = aliceWallet();
    const from = wallet.account.address;
    const value = parseUnits(amount || "0", 18);

    // Simulate first so a compliance block returns the reason without spending gas.
    try {
      await publicClient.simulateContract({
        account: from,
        address: addresses.token,
        abi: compliantTokenAbi,
        functionName: "transfer",
        args: [to, value],
      });
    } catch (sim) {
      return NextResponse.json({ allowed: false, reason: revertReason(sim) });
    }

    const hash = await wallet.writeContract({
      address: addresses.token,
      abi: compliantTokenAbi,
      functionName: "transfer",
      args: [to, value],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return NextResponse.json({ allowed: false, reason: "transaction reverted", hash });
    }
    return NextResponse.json({ allowed: true, hash });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "transfer failed" }, { status: 500 });
  }
}
