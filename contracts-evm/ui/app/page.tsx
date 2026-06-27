import { privateKeyToAccount } from "viem/accounts";
import { formatUnits } from "viem";
import type { Address } from "viem";

import {
  amlOracleAbi,
  compliantTokenAbi,
  compliantWrapperAbi,
  identityRegistryAbi,
  mockUsdcAbi,
  modularComplianceAbi,
} from "@/lib/abis";
import { publicClient } from "@/lib/chain";
import { addresses, demo, explorerAddress, hashkeyTestnet } from "@/lib/config";
import { AmlScreening, PaymentSimulator, AgentConsole, WrapPanel, Onboard } from "@/components/Panels";
import { OperatorNav } from "@/components/OperatorNav";
import { AIOperator } from "@/components/AIOperator";
import { DemoControls } from "@/components/DemoControls";
import { GrowthInbox } from "@/components/GrowthInbox";
import { cohort } from "@/lib/cohort";
import { scoreOpportunity, recommendedAction, type OppResult } from "@/lib/opportunity";

export const dynamic = "force-dynamic";

type IdentityRow = {
  label: string;
  address: Address;
  verified: boolean;
  frozen: boolean;
  identity: {
    kycLevel: number;
    jurisdiction: number;
    expiry: bigint;
    whitelisted: boolean;
  };
  risk: {
    score: number;
    updatedAt: bigint;
    modelRef: string;
  };
  balance: bigint;
  opp: OppResult;
};

type DashboardData = {
  tokenName: string;
  tokenSymbol: string;
  totalSupply: bigint;
  minKycLevel: number;
  rows: IdentityRow[];
  holdings: {
    alice: bigint;
    bob: bigint;
    deployer: bigint;
    wrapperBacking: bigint;
  };
};

const HEADER_LINKS = [
  { label: "Registry", address: addresses.registry },
  { label: "AML Oracle", address: addresses.aml },
  { label: "Compliance", address: addresses.compliance },
  { label: "cUSDC", address: addresses.token },
  { label: "MockUSDC", address: addresses.mockUsdc },
  { label: "Wrapper", address: addresses.wrapper },
] as const;

// Monitored accounts = the AI operator's watched cohort.
const PARTY_LABELS = cohort.map((m) => ({ label: m.label, address: m.address, growth: m.growth }));

function formatToken(value: bigint): string {
  const numeric = Number(formatUnits(value, 18));
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatShortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function riskBand(score: number): "low" | "medium" | "high" {
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function bandClasses(band: "low" | "medium" | "high"): string {
  if (band === "high") return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30";
  if (band === "medium") return "bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/30";
  return "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/30";
}

function oppBandClasses(tier: string): string {
  if (tier === "strategic") return "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/30";
  if (tier === "priority") return "bg-sky-500/15 text-sky-100 ring-1 ring-sky-300/30";
  return "bg-white/6 text-slate-300 ring-1 ring-white/10";
}

function jurisdictionLabel(code: number): string {
  if (code === 392) return "JP";
  if (code === 840) return "US";
  if (code === 0) return "Unassigned";
  return `#${code}`;
}

function deployerAddress(): Address {
  const key = process.env.PRIVATE_KEY;
  if (!key) {
    return "0x0000000000000000000000000000000000000000";
  }

  return privateKeyToAccount(key as `0x${string}`).address;
}

async function loadDashboardData(): Promise<DashboardData> {
  const [tokenName, tokenSymbol, totalSupply, minKycLevel] = await Promise.all([
    publicClient.readContract({
      address: addresses.token,
      abi: compliantTokenAbi,
      functionName: "name",
    }),
    publicClient.readContract({
      address: addresses.token,
      abi: compliantTokenAbi,
      functionName: "symbol",
    }),
    publicClient.readContract({
      address: addresses.token,
      abi: compliantTokenAbi,
      functionName: "totalSupply",
    }),
    publicClient.readContract({
      address: addresses.compliance,
      abi: modularComplianceAbi,
      functionName: "minKycLevel",
    }),
  ]);

  const deployer = deployerAddress();
  const rows = await Promise.all(
    PARTY_LABELS.map(async ({ label, address, growth }) => {
      const [verified, frozen, identity, risk, balance] = await Promise.all([
        publicClient.readContract({
          address: addresses.registry,
          abi: identityRegistryAbi,
          functionName: "isVerified",
          args: [address, minKycLevel],
        }),
        publicClient.readContract({
          address: addresses.registry,
          abi: identityRegistryAbi,
          functionName: "isFrozen",
          args: [address],
        }),
        publicClient.readContract({
          address: addresses.registry,
          abi: identityRegistryAbi,
          functionName: "identityOf",
          args: [address],
        }),
        publicClient.readContract({
          address: addresses.aml,
          abi: amlOracleAbi,
          functionName: "riskOf",
          args: [address],
        }),
        publicClient.readContract({
          address: addresses.token,
          abi: compliantTokenAbi,
          functionName: "balanceOf",
          args: [address],
        }),
      ]);

      return {
        label,
        address,
        verified,
        frozen,
        identity: {
          kycLevel: identity.kycLevel,
          jurisdiction: identity.jurisdiction,
          expiry: identity.expiry,
          whitelisted: identity.whitelisted,
        },
        risk: {
          score: risk.score,
          updatedAt: risk.updatedAt,
          modelRef: risk.modelRef,
        },
        balance,
        opp: scoreOpportunity(growth ?? {}),
      } satisfies IdentityRow;
    }),
  );

  const [aliceBalance, bobBalance, deployerBalance, wrapperBacking] = await Promise.all([
    publicClient.readContract({
      address: addresses.token,
      abi: compliantTokenAbi,
      functionName: "balanceOf",
      args: [demo.alice],
    }),
    publicClient.readContract({
      address: addresses.token,
      abi: compliantTokenAbi,
      functionName: "balanceOf",
      args: [demo.bob],
    }),
    publicClient.readContract({
      address: addresses.token,
      abi: compliantTokenAbi,
      functionName: "balanceOf",
      args: [deployer],
    }),
    publicClient.readContract({
      address: addresses.mockUsdc,
      abi: mockUsdcAbi,
      functionName: "balanceOf",
      args: [addresses.wrapper],
    }),
  ]);

  return {
    tokenName,
    tokenSymbol,
    totalSupply,
    minKycLevel,
    rows,
    holdings: {
      alice: aliceBalance,
      bob: bobBalance,
      deployer: deployerBalance,
      wrapperBacking,
    },
  };
}

function HeaderCard() {
  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-sky-950/20 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-sky-300/70">AI Operations Console · Protect + Grow</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">accredit</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            The AI operations layer for regulated on-chain finance on HashKey Chain. One pass:
            <span className="text-sky-200"> protect</span> (screen, contain, enforce) and
            <span className="text-emerald-200"> grow</span> (surface high-value prospects for the BD team) —
            human in the loop. Live on testnet.
          </p>
        </div>
        <div className="rounded-2xl border border-sky-400/15 bg-sky-400/10 px-4 py-3 text-sm text-sky-50">
          <div className="font-medium">{hashkeyTestnet.name}</div>
          <div className="mt-1 text-sky-100/70">Chain ID {hashkeyTestnet.id}</div>
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {HEADER_LINKS.map((item) => (
          <a
            key={item.label}
            href={explorerAddress(item.address)}
            target="_blank"
            rel="noreferrer"
            className="group rounded-2xl border border-white/8 bg-white/5 px-4 py-3 hover:border-sky-300/30 hover:bg-white/8"
          >
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{item.label}</div>
            <div className="mt-2 font-mono text-sm text-slate-100 group-hover:text-sky-100">
              {formatShortAddress(item.address)}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function IdentityTable({ rows }: { rows: IdentityRow[] }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-900/75 p-6 backdrop-blur">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Identity & Risk</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Live KYC and AML status</h2>
          <p className="mt-1 text-sm text-slate-400">Who may hold cUSDC — and their live AML risk.</p>
        </div>
        <div className="text-sm text-slate-400">Alice, Bob, and the demo watchlist address</div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.24em] text-slate-500">
              <th className="pb-3 pr-6 font-medium">Account</th>
              <th className="pb-3 pr-6 font-medium">KYC Verified</th>
              <th className="pb-3 pr-6 font-medium">Frozen</th>
              <th className="pb-3 pr-6 font-medium">Identity</th>
              <th className="pb-3 pr-6 font-medium">AML</th>
              <th className="pb-3 pr-6 font-medium">cUSDC</th>
              <th className="pb-3 font-medium">Opportunity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {rows.map((row) => {
              const band = riskBand(row.risk.score);
              return (
                <tr key={row.address} className="align-top">
                  <td className="py-4 pr-6">
                    <div className="font-medium text-white">{row.label}</div>
                    <a
                      href={explorerAddress(row.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block font-mono text-xs text-sky-200/80 hover:text-sky-100"
                    >
                      {formatShortAddress(row.address)}
                    </a>
                  </td>
                  <td className="py-4 pr-6">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        row.verified
                          ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/30"
                          : "bg-white/6 text-slate-300 ring-1 ring-white/10"
                      }`}
                    >
                      {row.verified ? "Verified" : "Not verified"}
                    </span>
                  </td>
                  <td className="py-4 pr-6">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        row.frozen
                          ? "bg-rose-500/15 text-rose-100 ring-1 ring-rose-400/30"
                          : "bg-white/6 text-slate-300 ring-1 ring-white/10"
                      }`}
                    >
                      {row.frozen ? "Frozen" : "Active"}
                    </span>
                  </td>
                  <td className="py-4 pr-6 text-slate-300">
                    <div>Level {row.identity.kycLevel}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {jurisdictionLabel(row.identity.jurisdiction)} · {row.identity.whitelisted ? "whitelisted" : "not listed"}
                    </div>
                  </td>
                  <td className="py-4 pr-6">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{row.risk.score}</span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase ${bandClasses(band)}`}>
                        {band}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {row.risk.updatedAt === 0n ? "Not attested" : `Model ${row.risk.modelRef.slice(0, 10)}…`}
                    </div>
                  </td>
                  <td className="py-4 pr-6 font-medium text-slate-100">{formatToken(row.balance)}</td>
                  <td className="py-4">
                    {row.frozen ? (
                      <span className="text-xs text-slate-500">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{row.opp.score}</span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase ${oppBandClasses(row.opp.tier)}`}>
                          {row.opp.tier}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <section className="rounded-[28px] border border-rose-400/20 bg-rose-500/10 p-6 text-rose-50">
      <p className="text-xs uppercase tracking-[0.28em] text-rose-200/70">Live Read Unavailable</p>
      <h2 className="mt-2 text-xl font-semibold">RPC data could not be loaded in this environment.</h2>
      <p className="mt-3 max-w-2xl text-sm text-rose-100/80">{message}</p>
    </section>
  );
}

function GroupHeader({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400/15 text-sm font-semibold text-sky-100 ring-1 ring-sky-300/30">
        {n}
      </span>
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400">{desc}</p>
      </div>
    </div>
  );
}

function MonitorSummary({ data }: { data: DashboardData }) {
  const verified = data.rows.filter((r) => r.verified).length;
  const highRisk = data.rows.filter((r) => r.risk.score >= 50).length;
  const frozen = data.rows.filter((r) => r.frozen).length;
  const pending = data.rows.filter((r) => !r.verified).length;
  const prospects = data.rows.filter((r) => !r.frozen && r.opp.tier !== "lead").length;
  const strategic = data.rows.filter((r) => !r.frozen && r.opp.tier === "strategic").length;
  const flows = data.rows.filter((r) => !r.frozen && r.opp.intent).length;
  const cards = [
    { label: "Monitored accounts", value: String(data.rows.length), kind: "risk" as const },
    { label: "Open alerts (high risk)", value: String(highRisk), kind: "risk" as const },
    { label: "Contained (frozen)", value: String(frozen), kind: "risk" as const },
    { label: "Prospects identified", value: String(prospects), kind: "growth" as const },
    { label: "Strategic leads", value: String(strategic), kind: "growth" as const },
    { label: "Notable inbound flows", value: String(flows), kind: "growth" as const },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl border px-4 py-3 backdrop-blur ${
            c.kind === "growth" ? "border-emerald-300/20 bg-emerald-500/5" : "border-white/10 bg-slate-900/75"
          }`}
        >
          <div className={`text-xs uppercase tracking-[0.18em] ${c.kind === "growth" ? "text-emerald-200/80" : "text-slate-400"}`}>
            {c.kind === "growth" ? "↗ " : ""}{c.label}
          </div>
          <div className="mt-1 text-lg font-semibold text-white">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

export default async function Home() {
  try {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-10">
        <HeaderCard />
        <OperatorNav />

        <div id="grp-ai" className="flex scroll-mt-6 flex-col gap-4 rounded-[28px] transition-shadow">
          <GroupHeader n={1} title="AI operations sweep" desc="Run the AI pass to screen every account and populate the console — protect + grow." />
          <AIOperator />
        </div>

        <details id="grp-intervene" className="scroll-mt-6 rounded-[28px] border border-white/10 bg-slate-900/40 p-2 backdrop-blur">
          <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 hover:bg-white/5">
            <span className="text-sm font-semibold text-white">Manual interventions</span>
            <span className="ml-2 text-sm text-slate-400">— act on a case by hand: screen, transfer policy, freeze / recover (click to expand)</span>
          </summary>
          <div className="mt-3 flex flex-col gap-4 px-1">
            <AmlScreening dead={demo.dead} />
            <PaymentSimulator alice={demo.alice} bob={demo.bob} dead={demo.dead} />
            <AgentConsole alice={demo.alice} dead={demo.dead} />
          </div>
        </details>

        <details id="grp-issuance" className="scroll-mt-6 rounded-[28px] border border-white/10 bg-slate-900/40 p-2 backdrop-blur">
          <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 hover:bg-white/5">
            <span className="text-sm font-semibold text-white">Issuance operations</span>
            <span className="ml-2 text-sm text-slate-400">— routine treasury / onboarding: onboard, wrap / unwrap (click to expand)</span>
          </summary>
          <div className="mt-3 flex flex-col gap-4 px-1">
            <Onboard />
            <WrapPanel />
          </div>
        </details>

        <DemoControls />
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown RPC read error.";

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-10">
        <HeaderCard />
        <ErrorCard message={message} />
      </main>
    );
  }
}
