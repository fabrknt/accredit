import { NextResponse } from "next/server";
import type { Address, Hex } from "viem";
import { publicClient } from "@/lib/chain";
import { agentWallet, runScorer } from "@/lib/server";
import { identityRegistryAbi, amlOracleAbi } from "@/lib/abis";
import { addresses } from "@/lib/config";
import { cohort } from "@/lib/cohort";
import { decide } from "@/lib/operator";
import { scoreOpportunity } from "@/lib/opportunity";

export const runtime = "nodejs";
export const maxDuration = 300;

const MANUAL_MIN_PER_ITEM = 3; // explicit assumption shown in the UI

export async function POST() {
  try {
    return await runSweep();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "sweep failed" }, { status: 500 });
  }
}

async function runSweep() {
  const startedAt = Date.now();
  const wallet = agentWallet();

  const log: unknown[] = [];
  const escalations: unknown[] = [];
  let onchainActions = 0;
  let prospects = 0;

  const attest = async (addr: Address, score: number, modelRef: Hex) => {
    const h = await wallet.writeContract({
      address: addresses.aml, abi: amlOracleAbi, functionName: "attestRisk", args: [addr, score, modelRef],
    });
    const r = await publicClient.waitForTransactionReceipt({ hash: h });
    if (r.status !== "success") throw new Error("attestRisk reverted");
    onchainActions++;
    return h;
  };

  for (const m of cohort) {
    const addr = m.address;
    const risk = await runScorer(addr, m.counterparties ?? [], m.signals?.txCount);
    const watchlistHit = (risk.breakdown.find((b) => b.id === "sanctioned_direct")?.score ?? 0) >= 100;

    const [isVerified, isFrozen] = await Promise.all([
      publicClient.readContract({ address: addresses.registry, abi: identityRegistryAbi, functionName: "isVerified", args: [addr, 1] }),
      publicClient.readContract({ address: addresses.registry, abi: identityRegistryAbi, functionName: "isFrozen", args: [addr] }),
    ]);

    const decision = decide({
      score: risk.score,
      watchlistHit,
      pendingOnboard: Boolean(m.pendingOnboard) && !isVerified,
      alreadyFrozen: isFrozen,
    });

    // Growth engine (advisory, no on-chain action): surface prospects on the same pass.
    if (decision.band !== "sanctions") {
      const opp = scoreOpportunity(m.growth ?? {});
      if (opp.tier !== "lead") prospects++;
    }

    let headline = "screened — no change";
    let tx: Hex | undefined;

    try {
      // Ensure on the roster (register once). For sanctions we also register so the
      // block reason is AML, not a missing identity.
      if (!isVerified) {
        const rh = await wallet.writeContract({
          address: addresses.registry, abi: identityRegistryAbi, functionName: "registerIdentity", args: [addr, 2, 392, 0n],
        });
        const rr = await publicClient.waitForTransactionReceipt({ hash: rh });
        if (rr.status !== "success") throw new Error("registerIdentity reverted");
        onchainActions++;
        headline = decision.band === "clean" ? "onboarded" : "registered";
      }

      if (decision.band === "sanctions") {
        tx = await attest(addr, risk.score, risk.modelRef);
        if (!isFrozen) {
          const fh = await wallet.writeContract({
            address: addresses.registry, abi: identityRegistryAbi, functionName: "setAddressFrozen", args: [addr, true],
          });
          const fr = await publicClient.waitForTransactionReceipt({ hash: fh });
          if (fr.status !== "success") throw new Error("setAddressFrozen reverted");
          onchainActions++;
          tx = fh;
        }
        headline = "auto-frozen (sanctions contained)";
      } else if (decision.band === "high") {
        tx = await attest(addr, risk.score, risk.modelRef);
        headline = "verdict anchored — freeze escalated";
      } else if (decision.band === "watch") {
        tx = await attest(addr, risk.score, risk.modelRef);
        headline = headline === "onboarded" ? "onboarded (watch)" : "monitored — anchored";
      } else {
        // clean
        tx = await attest(addr, risk.score, risk.modelRef);
        if (headline === "screened — no change") headline = "screened — anchored";
      }
    } catch (e) {
      headline = `action error: ${e instanceof Error ? e.message.split("\n")[0] : "unknown"}`;
    }

    log.push({
      label: m.label,
      address: addr,
      score: risk.score,
      band: decision.band,
      mode: decision.escalation ? "escalate" : "auto",
      headline,
      rationale: decision.rationale,
      tx,
    });

    if (decision.escalation) {
      escalations.push({
        label: m.label,
        address: addr,
        score: risk.score,
        band: decision.band,
        kind: decision.escalation.kind,
        recommendation: decision.escalation.recommendation,
      });
    }
  }

  const autoResolved = log.filter((l) => (l as { mode: string }).mode === "auto").length;
  const metrics = {
    screened: cohort.length,
    coveragePct: 100,
    autoResolved,
    escalated: escalations.length,
    prospects,
    onchainActions,
    elapsedSec: Math.round((Date.now() - startedAt) / 1000),
    manualEstimateMin: cohort.length * MANUAL_MIN_PER_ITEM,
  };

  return NextResponse.json({ log, escalations, metrics });
}
