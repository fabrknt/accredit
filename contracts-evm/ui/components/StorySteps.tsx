"use client";

const STEPS = [
  { n: 1, title: "Onboard verified users", text: "Only KYC-verified, AML-screened wallets can hold or receive cHSP.", target: "sec-identity" },
  { n: 2, title: "A compliant payment", text: "A normal stablecoin transfer — but every move is checked at the contract.", target: "sec-payment" },
  { n: 3, title: "AI flags a bad actor", text: "An AI-AML model scores risk off-chain and anchors the verdict on-chain.", target: "sec-aml" },
  { n: 4, title: "Enforcement blocks it", text: "The on-chain verdict blocks the payment — automatically.", target: "sec-payment" },
  { n: 5, title: "Control & adoption", text: "Freeze/recover compromised funds; wrap existing HSP into compliance 1:1.", target: "sec-agent" },
] as const;

export function StorySteps() {
  function go(target: string) {
    const el = document.getElementById(target);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("ring-2", "ring-sky-400/70");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-sky-400/70"), 1600);
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-400">The story — click a step to jump</p>
      <ol className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {STEPS.map((s) => (
          <li key={`${s.n}-${s.target}`}>
            <button
              onClick={() => go(s.target)}
              className="flex h-full w-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-sky-300/40 hover:bg-white/10"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-400/15 text-sm font-semibold text-sky-100 ring-1 ring-sky-300/30">
                {s.n}
              </span>
              <span className="text-sm font-medium text-white">{s.title}</span>
              <span className="text-xs leading-relaxed text-slate-400">{s.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
