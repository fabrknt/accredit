"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const card = "rounded-[28px] border border-white/10 bg-slate-900/75 p-6 backdrop-blur";
const btn = "rounded-xl border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-50 hover:bg-sky-400/20 disabled:opacity-40";
const btnGhost = "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-40";
const explorerTx = (h: string) => `https://testnet-explorer.hsk.xyz/tx/${h}`;

function bandClass(b: string) {
  if (b === "sanctions") return "bg-rose-600/20 text-rose-100 ring-1 ring-rose-400/40";
  if (b === "high") return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30";
  if (b === "watch") return "bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/30";
  return "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/30";
}

type LogRow = { label: string; address: string; score: number; band: string; mode: string; headline: string; tx?: string };
type Esc = { label: string; address: string; score: number; band: string; kind: string; recommendation: string };
type Metrics = { screened: number; coveragePct: number; autoResolved: number; escalated: number; prospects: number; onchainActions: number; elapsedSec: number; manualEstimateMin: number };

export function AIOperator() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogRow[] | null>(null);
  const [escalations, setEscalations] = useState<Esc[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});

  async function runSweep() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/sweep", { method: "POST" });
      const j = await res.json();
      if (j.error) { setError(j.error); return; }
      setLog(j.log); setEscalations(j.escalations); setMetrics(j.metrics); setResolved({});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "sweep failed");
    } finally {
      setBusy(false);
    }
  }

  async function approve(e: Esc) {
    setResolved((r) => ({ ...r, [e.address]: "approving…" }));
    const res = await fetch("/api/freeze", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: e.address, frozen: true }),
    });
    const j = await res.json();
    setResolved((r) => ({ ...r, [e.address]: j.error ? `error: ${j.error}` : "approved — frozen" }));
    router.refresh();
  }

  function dismiss(e: Esc) {
    setResolved((r) => ({ ...r, [e.address]: "dismissed" }));
  }

  return (
    <section className={`${card} border-sky-400/20`}>
      <p className="text-xs uppercase tracking-[0.28em] text-sky-300/70">AI Compliance Operator</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Continuous compliance screening</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-300">
        Each run screens every monitored account, auto-resolves the routine (onboarding, verdict
        anchoring, sanctions containment), and routes only the judgment calls and irreversible actions
        to the review queue below.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={btn} onClick={runSweep} disabled={busy}>Run sweep now</button>
        <span className="text-xs text-slate-400">Automated screening · runs across all monitored accounts</span>
        {busy && (
          <span className="inline-flex items-center gap-2 text-sm text-sky-200">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300/30 border-t-sky-200" aria-hidden />
            Screening accounts &amp; executing on-chain… (~1 min)
          </span>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      {metrics && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { l: "Screened", v: `${metrics.screened}` },
              { l: "Coverage", v: `${metrics.coveragePct}%` },
              { l: "Auto-resolved", v: `${metrics.autoResolved}` },
              { l: "Escalated", v: `${metrics.escalated}` },
              { l: "Prospects surfaced", v: `${metrics.prospects}` },
              { l: "On-chain actions", v: `${metrics.onchainActions}` },
              { l: "Time", v: `${metrics.elapsedSec}s` },
            ].map((c) => (
              <div key={c.l} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{c.l}</div>
                <div className="mt-1 text-lg font-semibold text-white">{c.v}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-sky-100/90">
            AI sweep: <span className="font-semibold">{metrics.elapsedSec}s</span>, 100% coverage,
            full audit log. Manual equivalent ≈ <span className="font-semibold">{metrics.manualEstimateMin} min</span>{" "}
            ({metrics.screened} cases × ~3 min) — typically spot-checked, not full coverage.
          </p>
        </>
      )}

      {escalations.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-white">Human review queue — the AI proposes, you dispose</h3>
          <div className="mt-3 space-y-2">
            {escalations.map((e) => (
              <div key={e.address} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                <span className="font-medium text-white">{e.label}</span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase ${bandClass(e.band)}`}>{e.band}</span>
                <span className="text-sm text-slate-400">score {e.score}</span>
                <span className="text-sm text-slate-300">{e.recommendation}</span>
                <span className="ml-auto flex items-center gap-2">
                  {resolved[e.address] ? (
                    <span className="text-sm text-sky-200">{resolved[e.address]}</span>
                  ) : (
                    <>
                      <button className={btn} onClick={() => approve(e)}>Approve</button>
                      <button className={btnGhost} onClick={() => dismiss(e)}>Dismiss</button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {log && (
        <div className="mt-6 overflow-x-auto">
          <h3 className="text-sm font-semibold text-white">Decision log</h3>
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <th className="pb-2 pr-4">Account</th><th className="pb-2 pr-4">Band</th><th className="pb-2 pr-4">Mode</th>
                <th className="pb-2 pr-4">Action</th><th className="pb-2 pr-4">Score</th><th className="pb-2">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {log.map((l) => (
                <tr key={l.address}>
                  <td className="py-2 pr-4 font-medium text-white">{l.label}</td>
                  <td className="py-2 pr-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase ${bandClass(l.band)}`}>{l.band}</span></td>
                  <td className="py-2 pr-4 text-slate-300">{l.mode}</td>
                  <td className="py-2 pr-4 text-slate-300">{l.headline}</td>
                  <td className="py-2 pr-4 text-slate-300">{l.score}</td>
                  <td className="py-2">{l.tx ? <a className="font-mono text-xs text-sky-200 hover:text-sky-100" href={explorerTx(l.tx)} target="_blank" rel="noreferrer">{l.tx.slice(0, 10)}… ↗</a> : <span className="text-slate-600">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
