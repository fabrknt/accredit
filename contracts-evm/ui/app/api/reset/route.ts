import { NextResponse } from "next/server";
import { publicClient } from "@/lib/chain";
import { agentWallet } from "@/lib/server";
import { identityRegistryAbi } from "@/lib/abis";
import { addresses } from "@/lib/config";
import { cohort } from "@/lib/cohort";

export const runtime = "nodejs";
export const maxDuration = 300;

// Reset the demo cohort to a clean first-run state: revoke identities + unfreeze.
// Lets the next sweep show the full first-run experience (onboarding + auto-freeze).
export async function POST() {
  try {
    const wallet = agentWallet();
    let actions = 0;

    for (const m of cohort) {
      const [isVerified, isFrozen] = await Promise.all([
        publicClient.readContract({ address: addresses.registry, abi: identityRegistryAbi, functionName: "isVerified", args: [m.address, 1] }),
        publicClient.readContract({ address: addresses.registry, abi: identityRegistryAbi, functionName: "isFrozen", args: [m.address] }),
      ]);

      if (isFrozen) {
        const fh = await wallet.writeContract({
          address: addresses.registry, abi: identityRegistryAbi, functionName: "setAddressFrozen", args: [m.address, false],
        });
        const fr = await publicClient.waitForTransactionReceipt({ hash: fh });
        if (fr.status !== "success") throw new Error("unfreeze reverted");
        actions++;
      }

      if (isVerified) {
        const rh = await wallet.writeContract({
          address: addresses.registry, abi: identityRegistryAbi, functionName: "revokeIdentity", args: [m.address],
        });
        const rr = await publicClient.waitForTransactionReceipt({ hash: rh });
        if (rr.status !== "success") throw new Error("revokeIdentity reverted");
        actions++;
      }
    }

    return NextResponse.json({ reset: cohort.length, actions });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "reset failed" }, { status: 500 });
  }
}
