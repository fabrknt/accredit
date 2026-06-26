"use client";

const GROUPS = [
  { n: "1", title: "Automated screening", target: "grp-ai" },
  { n: "2", title: "Monitored accounts", target: "grp-monitor" },
  { n: "3", title: "Growth inbox", target: "grp-growth" },
  { n: "4", title: "Operator actions", target: "grp-tools" },
] as const;

export function OperatorNav() {
  function go(target: string) {
    const el = document.getElementById(target);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("ring-2", "ring-sky-400/70");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-sky-400/70"), 1600);
  }

  return (
    <nav className="rounded-[28px] border border-white/10 bg-slate-900/60 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 text-xs uppercase tracking-[0.28em] text-slate-400">Operator console</span>
        {GROUPS.map((g) => (
          <button
            key={g.target}
            onClick={() => go(g.target)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-sky-300/40 hover:bg-white/10"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-400/15 text-xs font-semibold text-sky-100">{g.n}</span>
            {g.title}
          </button>
        ))}
      </div>
    </nav>
  );
}
