"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DemoControls() {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function reset() {
    setResetting(true); setMsg(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const j = await res.json();
      setMsg(j.error ? `error: ${j.error}` : "cohort reset to first-run state");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "reset failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <footer className="mt-2 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-3 text-xs text-slate-500">
      <span className="uppercase tracking-[0.2em]">Demo controls</span>
      <button
        onClick={reset}
        disabled={resetting}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-40"
      >
        {resetting ? "Resetting…" : "Reset cohort"}
      </button>
      {msg && <span className="text-slate-400">{msg}</span>}
      <span className="ml-auto">Revokes + unfreezes the demo cohort for a clean first-run recording.</span>
    </footer>
  );
}
