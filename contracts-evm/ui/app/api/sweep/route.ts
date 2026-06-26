import { NextResponse } from "next/server";
import { formatUnits, type Address, type Hex } from "viem";
import { publicClient } from "@/lib/chain";
import { agentWallet, runScorer } from "@/lib/server";
import { identityRegistryAbi, amlOracleAbi, compliantTokenAbi } from "@/lib/abis";
import { addresses } from "@/lib/config";
import { cohort } from "@/lib/cohort";
import { decide } from "@/lib/operator";
import { scoreOpportunity, recommendedAction } from "@/lib/opportunity";

export const runtime = "nodejs";
export const maxDuration = 300;

const MANUAL_MIN_PER_ITEM = 3;

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
  const accounts: unknown[] = [];
  const prospectList: {
    label: string; address: string; score: number; tier: string;
    intent: boolean; recommendation: string; reasons: string[]; riskFlag: boolean;
  }[] = [];
  let onchainActions = 0;

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

    const [isVerified, isFrozen, identity, balance] = await Promise.all([
      publicClient.readContract({ address: addresses.registry, abi: identityRegistryAbi, functionName: "isVerified", args: [addr, 1] }),
      publicClient.readContract({ address: addresses.registry, abi: identityRegistryAbi, functionName: "isFrozen", args: [addr] }),
      publicClient.readContract({ address: addresses.registry, abi: identityRegistryAbi, functionName: "identityOf", args: [addr] }),
      publicClient.readContract({ address: addresses.token, abi: compliantTokenAbi, functionName: "balanceOf", args: [addr] }),
    ]);

    const decision = decide({
      score: risk.score,
      watchlistHit,
      pendingOnboard: Boolean(m.pendingOnboard) && !isVerified,
      alreadyFrozen: isFrozen,
    });

    let headline = "screened — no change";
    let tx: Hex | undefined;
    let finalVerified = isVerified;
    let finalFrozen = isFrozen;

    try {
      if (!isVerified) {
        const rh = await wallet.writeContract({
          address: addresses.registry, abi: identityRegistryAbi, functionName: "registerIdentity", args: [addr, 2, 392, 0n],
        });
        const rr = await publicClient.waitForTransactionReceipt({ hash: rh });
        if (rr.status !== "success") throw new Error("registerIdentity reverted");
        onchainActions++;
        finalVerified = true;
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
          finalFrozen = true;
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
        tx = await attest(addr, risk.score, risk.modelRef);
        if (headline === "screened — no change") headline = "screened — anchored";
      }
    } catch (e) {
      headline = `action error: ${e instanceof Error ? e.message.split("\n")[0] : "unknown"}`;
    }

    // Growth engine (advisory, no on-chain action) — same pass.
    const opp = scoreOpportunity(m.growth ?? {});
    const isProspect = decision.band !== "sanctions" && opp.tier !== "lead";
    if (isProspect) {
      prospectList.push({
        label: m.label, address: addr, score: opp.score, tier: opp.tier, intent: opp.intent,
        recommendation: recommendedAction(opp.tier, opp.intent), reasons: opp.reasons,
        riskFlag: risk.score >= 50,
      });
    }

    accounts.push({
      label: m.label, address: addr,
      verified: finalVerified, frozen: finalFrozen,
      kycLevel: identity.kycLevel, jurisdiction: identity.jurisdiction,
      riskScore: risk.score, riskBand: decision.band,
      oppScore: opp.score, oppTier: opp.tier, oppIntent: opp.intent,
      balance: formatUnits(balance, 18),
      headline, mode: decision.escalation ? "escalate" : "auto",
    });

    log.push({
      label: m.label, address: addr, score: risk.score, band: decision.band,
      mode: decision.escalation ? "escalate" : "auto", headline, rationale: decision.rationale, tx,
    });

    if (decision.escalation) {
      escalations.push({
        label: m.label, address: addr, score: risk.score, band: decision.band,
        kind: decision.escalation.kind, recommendation: decision.escalation.recommendation,
      });
    }
  }

  const autoResolved = log.filter((l) => (l as { mode: string }).mode === "auto").length;
  const contained = accounts.filter((a) => (a as { frozen: boolean }).frozen).length;
  const strategic = prospectList.filter((p) => p.tier === "strategic").length;
  const flows = prospectList.filter((p) => p.intent).length;

  const kpis = {
    monitored: cohort.length,
    openAlerts: escalations.length,
    contained,
    prospects: prospectList.length,
    strategic,
    flows,
  };

  const metrics = {
    screened: cohort.length,
    coveragePct: 100,
    autoResolved,
    escalated: escalations.length,
    prospects: prospectList.length,
    onchainActions,
    elapsedSec: Math.round((Date.now() - startedAt) / 1000),
    manualEstimateMin: cohort.length * MANUAL_MIN_PER_ITEM,
  };

  return NextResponse.json({ accounts, kpis, escalations, prospects: prospectList, log, metrics });
}
