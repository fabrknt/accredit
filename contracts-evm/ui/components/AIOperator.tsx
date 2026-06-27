"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GrowthInbox, type Prospect } from "@/components/GrowthInbox";

const card = "rounded-[28px] border border-white/10 bg-slate-900/75 p-6 backdrop-blur";
const btn = "rounded-xl border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-50 hover:bg-sky-400/20 disabled:opacity-40";
const btnGhost = "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-40";
const cta = "inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 to-emerald-400 px-6 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:from-sky-300 hover:to-emerald-300 hover:shadow-sky-400/50 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100";
const explorerTx = (h: string) => `https://testnet-explorer.hsk.xyz/tx/${h}`;

function riskClass(b: string) {
  if (b === "sanctions") return "bg-rose-600/20 text-rose-100 ring-1 ring-rose-400/40";
  if (b === "high") return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30";
  if (b === "watch") return "bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/30";
  return "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/30";
}
function oppClass(t: string) {
  if (t === "strategic") return "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/30";
  if (t === "priority") return "bg-sky-500/15 text-sky-100 ring-1 ring-sky-300/30";
  return "bg-white/6 text-slate-300 ring-1 ring-white/10";
}
async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

type Account = {
  label: string; address: string; verified: boolean; frozen: boolean; kycLevel: number; jurisdiction: number;
  riskScore: number; riskBand: string; oppScore: number; oppTier: string; oppIntent: boolean; balance: string; headline: string;
};
type Esc = { label: string; address: string; score: number; band: string; kind: string; recommendation: string };
type Kpis = { monitored: number; openAlerts: number; contained: number; prospects: number; strategic: number; flows: number };
type Metrics = { screened: number; coveragePct: number; autoResolved: number; escalated: number; prospects: number; onchainActions: number; elapsedSec: number; manualEstimateMin: number };
type LogRow = { label: string; address: string; score: number; band: string; mode: string; headline: string; tx?: string };
type ConsoleState = { accounts: Account[]; kpis: Kpis; escalations: Esc[]; prospects: Prospect[]; log: LogRow[]; metrics: Metrics };

export function AIOperator() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ConsoleState | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});

  async function runSweep() {
    setBusy(true); setError(null);
    try {
      const j = await postJson("/api/sweep");
      if (j.error) { setError(j.error); return; }
      setState(j as ConsoleState); setResolved({}); router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "sweep failed");
    } finally {
      setBusy(false);
    }
  }

  async function approve(e: Esc) {
    setResolved((r) => ({ ...r, [e.address]: "approving…" }));
    const j = await postJson("/api/freeze", { address: e.address, frozen: true });
    setResolved((r) => ({ ...r, [e.address]: j.error ? `error: ${j.error}` : "approved — frozen" }));
    router.refresh();
  }

  return (
    <section className={`${card} border-sky-400/20`}>
      <p className="text-xs uppercase tracking-[0.28em] text-sky-300/70">AI Compliance Operator</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Run the operations sweep</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-300">
        One pass screens every monitored account and populates the console: it auto-resolves the routine,
        contains sanctions, queues judgment calls for review (protect), and surfaces high-value prospects (grow).
      </p>

      <div className="mt-5">
        {!state && !busy ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-sky-400/25 bg-sky-400/5 px-4 py-10 text-center">
            <button className={`${cta} ring-2 ring-sky-300/40`} onClick={runSweep}>
              <span aria-hidden>▶</span> Run sweep now
            </button>
            <p className="max-w-md text-sm text-slate-400">
              The console is on standby. One sweep screens every account and fills the KPIs, the protect
              queue, growth prospects, and the audit log — about a minute.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button className={cta} onClick={runSweep} disabled={busy}>
              <span aria-hidden>▶</span> {busy ? "Sweeping…" : "Re-run sweep"}
            </button>
            {busy ? (
              <span className="inline-flex items-center gap-2 text-sm text-sky-200">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300/30 border-t-sky-200" aria-hidden />
                Screening accounts &amp; executing on-chain… (~1 min)
              </span>
            ) : (
              <span className="text-xs text-slate-400">Automated screening across all monitored accounts</span>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      {state && (
        <div className="mt-6 flex flex-col gap-6">
          {/* KPI bar */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { l: "Monitored", v: state.kpis.monitored, tone: "neutral" as const },
              { l: "Open alerts", v: state.kpis.openAlerts, tone: state.kpis.openAlerts > 0 ? ("alert" as const) : ("neutral" as const) },
              { l: "Contained", v: state.kpis.contained, tone: "neutral" as const },
              { l: "Prospects", v: state.kpis.prospects, tone: "growth" as const },
              { l: "Strategic", v: state.kpis.strategic, tone: "growth" as const },
              { l: "Notable flows", v: state.kpis.flows, tone: "growth" as const },
            ].map((c) => {
              const tint = c.tone === "alert" ? "border-rose-400/40 bg-rose-500/10" : c.tone === "growth" ? "border-emerald-300/20 bg-emerald-500/5" : "border-white/10 bg-slate-950/50";
              const lab = c.tone === "alert" ? "text-rose-200" : c.tone === "growth" ? "text-emerald-200/80" : "text-slate-400";
              return (
                <div key={c.l} className={`rounded-2xl border px-4 py-3 ${tint}`}>
                  <div className={`text-xs uppercase tracking-[0.16em] ${lab}`}>{c.tone === "growth" ? "↗ " : ""}{c.tone === "alert" ? "⚠ " : ""}{c.l}</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{c.v}</div>
                </div>
              );
            })}
          </div>

          <p className="text-sm text-sky-100/90">
            Sweep: <span className="font-semibold">{state.metrics.elapsedSec}s</span> · 100% coverage ·{" "}
            {state.metrics.autoResolved} auto-resolved · {state.metrics.escalated} escalated ·{" "}
            {state.metrics.prospects} prospects · {state.metrics.onchainActions} on-chain actions.
            Manual equivalent ≈ <span className="font-semibold">{state.metrics.manualEstimateMin} min</span>.
          </p>

          {/* Risk review queue */}
          {state.escalations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white">Protect · review queue — the AI proposes, you dispose</h3>
              <div className="mt-3 space-y-2">
                {state.escalations.map((e) => (
                  <div key={e.address} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                    <span className="font-medium text-white">{e.label}</span>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase ${riskClass(e.band)}`}>{e.band}</span>
                    <span className="text-sm text-slate-400">score {e.score}</span>
                    <span className="text-sm text-slate-300">{e.recommendation}</span>
                    <span className="ml-auto flex items-center gap-2">
                      {resolved[e.address] ? <span className="text-sm text-sky-200">{resolved[e.address]}</span> : (
                        <>
                          <button className={btn} onClick={() => approve(e)}>Approve</button>
                          <button className={btnGhost} onClick={() => setResolved((r) => ({ ...r, [e.address]: "dismissed" }))}>Dismiss</button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Growth opportunity inbox */}
          <GrowthInbox prospects={state.prospects} />

          {/* Monitored accounts */}
          <div className="overflow-x-auto">
            <h3 className="text-sm font-semibold text-white">Monitored accounts</h3>
            <table className="mt-3 min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  <th className="pb-2 pr-6">Account</th><th className="pb-2 pr-6">KYC</th><th className="pb-2 pr-6">Risk</th>
                  <th className="pb-2 pr-6">Opportunity</th><th className="pb-2 pr-6">Action</th><th className="pb-2">cUSDC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {state.accounts.map((a) => (
                  <tr key={a.address}>
                    <td className="py-3 pr-6">
                      <div className="font-medium text-white">{a.label}</div>
                      <div className="font-mono text-xs text-sky-200/70">{a.address.slice(0, 6)}…{a.address.slice(-4)}</div>
                    </td>
                    <td className="py-3 pr-6">{a.frozen ? <span className="text-rose-200">frozen</span> : a.verified ? <span className="text-emerald-200">verified</span> : <span className="text-slate-400">—</span>}</td>
                    <td className="py-3 pr-6"><span className="font-semibold text-white">{a.riskScore}</span> <span className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${riskClass(a.riskBand)}`}>{a.riskBand}</span></td>
                    <td className="py-3 pr-6">{a.frozen ? <span className="text-slate-500">—</span> : <><span className="font-semibold text-white">{a.oppScore}</span> <span className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${oppClass(a.oppTier)}`}>{a.oppTier}</span></>}</td>
                    <td className="py-3 pr-6 text-slate-300">{a.headline}</td>
                    <td className="py-3 text-slate-100">{a.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Decision log / audit trail */}
          <div className="overflow-x-auto">
            <h3 className="text-sm font-semibold text-white">Audit trail — decision log</h3>
            <table className="mt-3 min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  <th className="pb-2 pr-4">Account</th><th className="pb-2 pr-4">Band</th><th className="pb-2 pr-4">Mode</th><th className="pb-2 pr-4">Action</th><th className="pb-2">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {state.log.map((l) => (
                  <tr key={l.address}>
                    <td className="py-2 pr-4 font-medium text-white">{l.label}</td>
                    <td className="py-2 pr-4"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${riskClass(l.band)}`}>{l.band}</span></td>
                    <td className="py-2 pr-4 text-slate-300">{l.mode}</td>
                    <td className="py-2 pr-4 text-slate-300">{l.headline}</td>
                    <td className="py-2">{l.tx ? <a className="font-mono text-xs text-sky-200 hover:text-sky-100" href={explorerTx(l.tx)} target="_blank" rel="noreferrer">{l.tx.slice(0, 10)}… ↗</a> : <span className="text-slate-600">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
