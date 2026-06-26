"use client";

import { useState } from "react";

export interface Prospect {
  label: string;
  address: string;
  score: number;
  tier: "lead" | "priority" | "strategic";
  intent: boolean;
  recommendation: string;
  reasons: string[];
  riskFlag: boolean; // valuable but risk-escalated
}

function tierClass(t: string) {
  if (t === "strategic") return "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/30";
  if (t === "priority") return "bg-sky-500/15 text-sky-100 ring-1 ring-sky-300/30";
  return "bg-white/6 text-slate-300 ring-1 ring-white/10";
}

export function GrowthInbox({ prospects }: { prospects: Prospect[] }) {
  const [acted, setActed] = useState<Record<string, string>>({});

  if (prospects.length === 0) {
    return (
      <section className="rounded-[28px] border border-emerald-300/20 bg-emerald-500/5 p-6 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/80">Growth · Opportunity inbox</p>
        <p className="mt-2 text-sm text-slate-300">No prospects surfaced yet — run a sweep or onboard accounts.</p>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-emerald-300/20 bg-emerald-500/5 p-6 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/80">Growth · Opportunity inbox</p>
      <h2 className="mt-2 text-xl font-semibold text-white">High-value prospects to act on</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">
        Surfaced from public on-chain signals to prioritize legitimate BD / onboarding outreach. Advisory
        only — the AI routes leads to a human; it never trades on or front-runs a transaction.
      </p>
      <div className="mt-4 space-y-2">
        {prospects.map((p) => (
          <div key={p.address} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <span className="font-medium text-white">{p.label}</span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase ${tierClass(p.tier)}`}>{p.tier}</span>
            <span className="text-sm text-slate-400">opp {p.score}</span>
            {p.intent && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium uppercase text-amber-100 ring-1 ring-amber-300/30">inbound flow</span>}
            {p.riskFlag && <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-medium uppercase text-rose-200 ring-1 ring-rose-400/30">valuable · risk-flagged</span>}
            <span className="text-sm text-slate-300">{p.recommendation}</span>
            <span className="ml-auto flex items-center gap-2">
              {acted[p.address] ? (
                <span className="text-sm text-emerald-200">{acted[p.address]}</span>
              ) : (
                <>
                  <button
                    onClick={() => setActed((a) => ({ ...a, [p.address]: "flagged for outreach" }))}
                    className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-400/20"
                  >
                    Flag for outreach
                  </button>
                  <button
                    onClick={() => setActed((a) => ({ ...a, [p.address]: "assigned to RM" }))}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                  >
                    Assign
                  </button>
                  <button
                    onClick={() => setActed((a) => ({ ...a, [p.address]: "dismissed" }))}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 hover:bg-white/10"
                  >
                    Dismiss
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
