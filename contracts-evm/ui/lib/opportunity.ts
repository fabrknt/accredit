// Growth engine — opportunity scoring (offensive mirror of the risk score).
// Transparent, explainable, advisory-only: it routes leads to a human; it never trades,
// front-runs, or acts on a pending transaction. Public/provided on-chain signals only.

export type OppTier = "lead" | "priority" | "strategic";

export interface GrowthSignals {
  volume?: number; // 0–100 activity / throughput
  strategic?: boolean; // holds/uses HashKey-priority assets (HSP / RWA / key protocols)
  inbound?: number; // 0–100 recent inbound capital — intent ("about to do something")
  growth?: number; // 0–100 activity growth
}

export interface OppFeature { id: string; weight: number; score: number; contribution: number; reason: string }
export interface OppResult {
  score: number;
  tier: OppTier;
  intent: boolean;
  reasons: string[];
  breakdown: OppFeature[];
}

// Weights sum to 100. Holdings is shown as context (not scored) — prospects often don't hold yet.
const W = { strategic: 35, inbound: 25, volume: 22, growth: 18 };

export function scoreOpportunity(signals: GrowthSignals): OppResult {
  const breakdown: OppFeature[] = [];
  const add = (id: string, weight: number, raw: number, reason: string) => {
    const r = Math.max(0, Math.min(100, raw));
    const contribution = Math.round((weight * r) / 100);
    breakdown.push({ id, weight, score: r, contribution, reason });
    return contribution;
  };

  let total = 0;
  total += add("strategic", W.strategic, signals.strategic ? 100 : 0,
    signals.strategic ? "Holds/uses HashKey-priority assets (HSP/RWA)." : "No strategic asset alignment.");
  total += add("inbound", W.inbound, signals.inbound ?? 0,
    (signals.inbound ?? 0) >= 50 ? "Large recent inbound capital — time-sensitive." : "No notable inbound capital.");
  total += add("volume", W.volume, signals.volume ?? 0, `Activity volume ${signals.volume ?? 0}/100.`);
  total += add("growth", W.growth, signals.growth ?? 0, `Activity growth ${signals.growth ?? 0}/100.`);

  const score = Math.max(0, Math.min(100, total));
  const tier: OppTier = score >= 70 ? "strategic" : score >= 40 ? "priority" : "lead";
  const intent = (signals.inbound ?? 0) >= 50;
  const reasons = breakdown.filter((f) => f.contribution > 0).map((f) => f.reason);
  return { score, tier, intent, reasons, breakdown };
}

export function recommendedAction(tier: OppTier, intent: boolean): string {
  if (intent) return "Notable inbound flow — time-sensitive outreach.";
  if (tier === "strategic") return "Assign a relationship manager; fast-track onboarding.";
  if (tier === "priority") return "Prioritize onboarding / outreach.";
  return "Standard onboarding; keep monitoring.";
}
