"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Hex = string;

const card =
  "rounded-[28px] border border-white/10 bg-slate-900/75 p-6 backdrop-blur";
const label = "text-xs uppercase tracking-[0.28em] text-slate-400";
const input =
  "w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-sky-300/40";
const btn =
  "rounded-xl border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-50 hover:bg-sky-400/20 disabled:opacity-40";
const btnGhost =
  "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-40";

function bandClasses(band: string): string {
  if (band === "high") return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30";
  if (band === "medium") return "bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/30";
  return "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/30";
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

const explorerTx = (h: string) => `https://testnet-explorer.hsk.xyz/tx/${h}`;

function Processing({ label = "Processing — waiting for the transaction…" }: { label?: string }) {
  return (
    <span className="mt-3 inline-flex items-center gap-2 text-sm text-sky-200">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300/30 border-t-sky-200" aria-hidden />
      {label}
    </span>
  );
}

function TxLink({ hash }: { hash: Hex }) {
  return (
    <a href={explorerTx(hash)} target="_blank" rel="noreferrer" className="font-mono text-xs text-sky-200 hover:text-sky-100">
      {hash.slice(0, 10)}… ↗
    </a>
  );
}

type RiskBreakdown = { id: string; score: number; weight: number; contribution: number; reason: string };
type RiskResult = { address: string; score: number; band: string; reasons: string[]; breakdown: RiskBreakdown[]; modelRef: string };

export function AmlScreening({ dead }: { dead: string }) {
  const router = useRouter();
  const [address, setAddress] = useState(dead);
  const [counterparty, setCounterparty] = useState("");
  const [result, setResult] = useState<RiskResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counterparties = counterparty.trim() ? [counterparty.trim()] : [];

  async function score() {
    setBusy(true); setError(null); setTx(null);
    const r = await postJson("/api/score", { address, counterparties });
    setBusy(false);
    if (r.error) return setError(r.error);
    setResult(r as RiskResult);
  }

  async function anchor() {
    setBusy(true); setError(null);
    const r = await postJson("/api/attest", { address, counterparties });
    setBusy(false);
    if (r.error) return setError(r.error);
    setTx(r.hash);
    router.refresh();
  }

  return (
    <section className={card}>
      <p className={label}>AI-AML Screening</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Score an address, anchor the verdict on-chain</h2>
      <p className="mt-1 text-sm text-slate-400">The AI that decides: explainable, and anchored on-chain.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs text-slate-400">Address</div>
          <input className={input} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <div className="mb-1 text-xs text-slate-400">Counterparty (optional)</div>
          <input className={input} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="0x… sanctioned?" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className={btn} onClick={score} disabled={busy}>Run scorer</button>
        <button className={btnGhost} onClick={anchor} disabled={busy || !result}>Anchor on-chain (attestRisk)</button>
      </div>
      {busy && <Processing />}
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {tx && <p className="mt-3 text-sm text-slate-300">Anchored: <TxLink hash={tx} /></p>}
      {result && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold text-white">{result.score}</span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase ${bandClasses(result.band)}`}>{result.band}</span>
            <span className="ml-auto font-mono text-xs text-slate-500">model {result.modelRef.slice(0, 10)}…</span>
          </div>
          <table className="mt-4 w-full text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-[0.2em] text-slate-500"><th className="pb-2 pr-4">Feature</th><th className="pb-2 pr-4">Weight</th><th className="pb-2 pr-4">Contribution</th><th className="pb-2">Reason</th></tr></thead>
            <tbody className="divide-y divide-white/6">
              {result.breakdown.map((b) => (
                <tr key={b.id}><td className="py-2 pr-4 font-mono text-slate-200">{b.id}</td><td className="py-2 pr-4 text-slate-400">{b.weight.toFixed(2)}</td><td className="py-2 pr-4 text-slate-300">{b.contribution.toFixed(2)}</td><td className="py-2 text-slate-400">{b.reason}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function PaymentSimulator({ alice, bob, dead }: { alice: string; bob: string; dead: string }) {
  const router = useRouter();
  const [to, setTo] = useState(bob);
  const [amount, setAmount] = useState("50");
  const [check, setCheck] = useState<{ allowed: boolean; reason: string } | null>(null);
  const [tx, setTx] = useState<Hex | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function preview(target = to) {
    setBusy(true); setError(null); setTx(null);
    const r = await postJson("/api/can-transfer", { from: alice, to: target, amount });
    setBusy(false);
    if (r.error) return setError(r.error);
    setCheck(r);
  }

  async function execute(target = to) {
    setBusy(true); setError(null);
    const r = await postJson("/api/transfer", { to: target, amount });
    setBusy(false);
    if (r.error) return setError(r.error);
    setCheck({ allowed: r.allowed, reason: r.reason ?? "" });
    if (r.allowed && r.hash) { setTx(r.hash); router.refresh(); }
  }

  return (
    <section className={card}>
      <p className={label}>Transfer Policy & Enforcement</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Check a transfer — and watch it enforced</h2>
      <p className="mt-1 text-sm text-slate-400">Compliance is enforced at the moment of transfer; flagged recipients are blocked.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-1 text-xs text-slate-400">Recipient</div>
          <input className={input} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <div className="mb-1 text-xs text-slate-400">Amount (cUSDC)</div>
          <input className={`${input} w-32`} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className={btnGhost} onClick={() => { setTo(bob); preview(bob); }} disabled={busy}>Alice → Bob</button>
        <button className={btnGhost} onClick={() => { setTo(dead); preview(dead); }} disabled={busy}>Alice → flagged</button>
        <button className={btn} onClick={() => preview()} disabled={busy}>Check</button>
        <button className={btn} onClick={() => execute()} disabled={busy}>Execute</button>
      </div>
      {busy && <Processing />}
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {check && (
        <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${check.allowed ? "bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-400/20" : "bg-rose-500/10 text-rose-100 ring-1 ring-rose-400/20"}`}>
          {check.allowed ? "ALLOWED" : "BLOCKED"}{check.reason ? ` — ${check.reason}` : ""}
          {tx && <span className="ml-2">· <TxLink hash={tx} /></span>}
        </div>
      )}
    </section>
  );
}

export function AgentConsole({ alice, dead }: { alice: string; dead: string }) {
  const router = useRouter();
  const [address, setAddress] = useState(alice);
  const [tx, setTx] = useState<Hex | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setFrozen(frozen: boolean) {
    setBusy(true); setError(null); setTx(null);
    const r = await postJson("/api/freeze", { address, frozen });
    setBusy(false);
    if (r.error) return setError(r.error);
    setTx(r.hash);
    router.refresh();
  }

  return (
    <section className={card}>
      <p className={label}>Agent Console</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Freeze / unfreeze (ERC-3643 agent power)</h2>
      <p className="mt-1 text-sm text-slate-400">Regulator-grade controls: freeze and recover.</p>
      <div className="mt-4">
        <div className="mb-1 text-xs text-slate-400">Address</div>
        <input className={input} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <button className={btnGhost} onClick={() => setAddress(alice)}>Alice</button>
        <button className={btnGhost} onClick={() => setAddress(dead)}>flagged</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className={btn} onClick={() => setFrozen(true)} disabled={busy}>Freeze</button>
        <button className={btnGhost} onClick={() => setFrozen(false)} disabled={busy}>Unfreeze</button>
      </div>
      {busy && <Processing />}
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {tx && <p className="mt-3 text-sm text-slate-300">Done: <TxLink hash={tx} /></p>}
    </section>
  );
}

export function Onboard() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [kycLevel, setKycLevel] = useState("2");
  const [jurisdiction, setJurisdiction] = useState("392");
  const [result, setResult] = useState<{ score: number; band: string } | null>(null);
  const [tx, setTx] = useState<Hex | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onboard() {
    setBusy(true); setError(null); setTx(null); setResult(null);
    const r = await postJson("/api/onboard", {
      address,
      kycLevel: Number(kycLevel),
      jurisdiction: Number(jurisdiction),
    });
    setBusy(false);
    if (r.error) return setError(r.error);
    setResult({ score: r.score, band: r.band });
    setTx(r.amlHash ?? r.regHash);
    router.refresh();
  }

  return (
    <section className={card}>
      <p className={label}>Onboard</p>
      <h2 className="mt-2 text-xl font-semibold text-white">KYC-register a new participant</h2>
      <p className="mt-1 text-sm text-slate-400">Verify identity and run the initial AML screen — required before holding cUSDC.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <div className="mb-1 text-xs text-slate-400">Address</div>
          <input className={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" />
        </div>
        <div>
          <div className="mb-1 text-xs text-slate-400">KYC level</div>
          <input className={`${input} w-24`} value={kycLevel} onChange={(e) => setKycLevel(e.target.value)} />
        </div>
        <div>
          <div className="mb-1 text-xs text-slate-400">Jurisdiction</div>
          <input className={`${input} w-28`} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
        </div>
      </div>
      <div className="mt-4">
        <button className={btn} onClick={onboard} disabled={busy || !address}>Onboard (register + screen)</button>
      </div>
      {busy && <Processing />}
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {result && (
        <p className="mt-3 text-sm text-slate-300">
          Onboarded — initial AML score {result.score} ({result.band}). {tx && <TxLink hash={tx} />}
        </p>
      )}
    </section>
  );
}

export function WrapPanel() {
  const router = useRouter();
  const [amount, setAmount] = useState("100");
  const [tx, setTx] = useState<Hex | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(kind: "wrap" | "unwrap") {
    setBusy(true); setError(null); setTx(null);
    const r = await postJson(`/api/${kind}`, { amount });
    setBusy(false);
    if (r.error) return setError(r.error);
    setTx(r.hash);
    router.refresh();
  }

  return (
    <section className={card}>
      <p className={label}>Compliant Wrapping</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Wrap USDC → cUSDC 1:1 (compliance-gated)</h2>
      <p className="mt-1 text-sm text-slate-400">Pull existing USDC liquidity into the compliance layer, 1:1.</p>
      <div className="mt-4">
        <div className="mb-1 text-xs text-slate-400">Amount</div>
        <input className={`${input} w-40`} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className={btn} onClick={() => go("wrap")} disabled={busy}>Wrap</button>
        <button className={btnGhost} onClick={() => go("unwrap")} disabled={busy}>Unwrap</button>
      </div>
      {busy && <Processing />}
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {tx && <p className="mt-3 text-sm text-slate-300">Done: <TxLink hash={tx} /></p>}
    </section>
  );
}
