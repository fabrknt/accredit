// AI compliance operator policy — pure decision logic (see docs/ai-operator-spec.md).
// Maps a screening result + on-chain context to an auto action and/or a human escalation.

export type Band = "clean" | "watch" | "high" | "sanctions";

export function classify(score: number, watchlistHit: boolean): Band {
  // "sanctions" = a deterministic confirmed list/watchlist hit only. A high MODEL score
  // is still model judgment (possible false positive) → it escalates, never auto-freezes.
  if (watchlistHit) return "sanctions";
  if (score >= 50) return "high";
  if (score >= 25) return "watch";
  return "clean";
}

export type AutoAction = "onboard" | "attest" | "freeze" | "none";
export type EscalationKind = "freeze" | "recovery";

export interface Decision {
  band: Band;
  autoAction: AutoAction;
  rationale: string;
  escalation?: { kind: EscalationKind; recommendation: string };
}

export interface DecisionContext {
  score: number;
  watchlistHit: boolean;
  pendingOnboard: boolean;
  alreadyFrozen: boolean;
}

// The automation / escalation boundary (confirmed):
// - clean: auto (onboard if pending, else no-op)
// - watch: auto-anchor, monitor
// - high (model, ambiguous): auto-anchor the verdict; ESCALATE the freeze
// - sanctions (confirmed list hit / >=75): AUTO-freeze (contain); ESCALATE recovery
// - irreversible value moves (recovery/forcedTransfer): never auto
export function decide(ctx: DecisionContext): Decision {
  const band = classify(ctx.score, ctx.watchlistHit);

  if (band === "sanctions") {
    return {
      band,
      autoAction: ctx.alreadyFrozen ? "none" : "freeze",
      rationale: "Confirmed sanctions/watchlist hit — auto-contained (frozen) and verdict anchored.",
      escalation: { kind: "recovery", recommendation: "Escalate fund recovery (forcedTransfer) for human approval." },
    };
  }

  if (band === "high") {
    return {
      band,
      autoAction: "attest",
      rationale: "Model-flagged high risk (ambiguous, not a list hit). Verdict anchored on-chain so incoming transfers auto-block; freeze decision escalated.",
      escalation: { kind: "freeze", recommendation: "Recommend freeze pending human review." },
    };
  }

  if (band === "watch") {
    return {
      band,
      autoAction: "attest",
      rationale: "Elevated but below the block threshold — score anchored and flagged for monitoring. No action required.",
    };
  }

  // clean
  if (ctx.pendingOnboard) {
    return { band, autoAction: "onboard", rationale: "KYC valid and AML clean — onboarding auto-approved and initial screen anchored." };
  }
  return { band, autoAction: "none", rationale: "Clean — screened, no change. No on-chain action needed." };
}
