import { NextResponse } from "next/server";
import { runScorer } from "@/lib/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { address, counterparties } = (await req.json()) as {
      address: string;
      counterparties?: string[];
    };
    if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
    const result = await runScorer(address, counterparties ?? []);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "score failed" }, { status: 500 });
  }
}
