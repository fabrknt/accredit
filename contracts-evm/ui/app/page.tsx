import { privateKeyToAccount } from "viem/accounts";
import { formatUnits } from "viem";
import type { Address } from "viem";

import {
  amlOracleAbi,
  compliantTokenAbi,
  compliantWrapperAbi,
  identityRegistryAbi,
  mockHspAbi,
  modularComplianceAbi,
} from "@/lib/abis";
import { publicClient } from "@/lib/chain";
import { addresses, demo, explorerAddress, hashkeyTestnet } from "@/lib/config";
import { AmlScreening, PaymentSimulator, AgentConsole, WrapPanel, Onboard } from "@/components/Panels";
import { OperatorNav } from "@/components/OperatorNav";
import { AIOperator } from "@/components/AIOperator";
import { DemoControls } from "@/components/DemoControls";
import { cohort } from "@/lib/cohort";

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
  { label: "cHSP", address: addresses.token },
  { label: "MockHSP", address: addresses.mockHsp },
  { label: "Wrapper", address: addresses.wrapper },
] as const;

// Monitored accounts = the AI operator's watched cohort.
const PARTY_LABELS = cohort.map((m) => ({ label: m.label, address: m.address }));

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
    PARTY_LABELS.map(async ({ label, address }) => {
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
      address: addresses.mockHsp,
      abi: mockHspAbi,
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
          <p className="text-xs uppercase tracking-[0.32em] text-sky-300/70">Compliance Operations Console</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">accredit</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            AI-run compliance operations for regulated tokens on HashKey Chain — automated screening
            and enforcement, with a human in the loop. Live on testnet.
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
          <p className="mt-1 text-sm text-slate-400">Who may hold cHSP — and their live AML risk.</p>
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
              <th className="pb-3 font-medium">cHSP</th>
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
                  <td className="py-4 font-medium text-slate-100">{formatToken(row.balance)}</td>
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
  const cards = [
    { label: "Monitored accounts", value: String(data.rows.length) },
    { label: "Open alerts (high risk)", value: String(highRisk) },
    { label: "Contained (frozen)", value: String(frozen) },
    { label: "Pending onboarding", value: String(pending) },
    { label: "KYC verified", value: String(verified) },
    { label: `${data.tokenSymbol} supply`, value: formatToken(data.totalSupply) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-white/10 bg-slate-900/75 px-4 py-3 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{c.label}</div>
          <div className="mt-1 text-lg font-semibold text-white">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

export default async function Home() {
  try {
    const data = await loadDashboardData();

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-10">
        <HeaderCard />
        <MonitorSummary data={data} />
        <OperatorNav />

        <div id="grp-ai" className="flex scroll-mt-6 flex-col gap-4 rounded-[28px] transition-shadow">
          <GroupHeader n={1} title="Automated screening" desc="The AI operator screens every account, auto-resolves the routine, and queues the rest for human review." />
          <AIOperator />
        </div>

        <div id="grp-monitor" className="flex scroll-mt-6 flex-col gap-4 rounded-[28px] transition-shadow">
          <GroupHeader n={2} title="Monitored accounts" desc="Live KYC and AML status of every account under monitoring." />
          <IdentityTable rows={data.rows} />
        </div>

        <div id="grp-tools" className="flex scroll-mt-6 flex-col gap-4 rounded-[28px] transition-shadow">
          <GroupHeader n={3} title="Operator actions" desc="Manual tools to act on a specific account — screen, transfer policy, freeze / recover, onboard, wrap." />
          <AmlScreening dead={demo.dead} />
          <PaymentSimulator alice={demo.alice} bob={demo.bob} dead={demo.dead} />
          <AgentConsole alice={demo.alice} dead={demo.dead} />
          <Onboard />
          <WrapPanel />
        </div>

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
