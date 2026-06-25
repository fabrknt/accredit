// SPDX-License-Identifier: Apache-2.0
import { accountNewnessScore, counterpartyCountScore, getFeatureNames, velocityScore } from "./training.js";
import type { Address, ChainReader, Feature, FeatureResult, ScoringContext } from "./types.js";

const FEATURE_NAMES = new Set(getFeatureNames());

async function resolveTxCount(
  address: Address,
  signals: ScoringContext["signals"],
  chain: ChainReader | undefined,
): Promise<number> {
  if (typeof signals?.txCount === "number") {
    return signals.txCount;
  }

  if (chain) {
    return chain.getTxCount(address);
  }

  return 0;
}

function normalizeAddress(address: Address): Address {
  return address.toLowerCase() as Address;
}

function matchedCounterparties(ctx: ScoringContext): Address[] {
  return ctx.counterparties.filter((counterparty) => ctx.watchlist.has(normalizeAddress(counterparty)));
}

function result(id: string, score: number, reason: string): FeatureResult {
  return { id, score, reason, weight: 0 };
}

export const sanctionedDirectFeature: Feature = (ctx) => {
  const matched = ctx.watchlist.has(normalizeAddress(ctx.address));
  return result(
    "sanctioned_direct",
    matched ? 100 : 0,
    matched
      ? "Address appears on the demo sanctions watchlist."
      : "Address does not appear on the demo sanctions watchlist.",
  );
};

export const sanctionedExposureFeature: Feature = (ctx) => {
  const matched = matchedCounterparties(ctx).length;
  return result(
    "sanctioned_exposure",
    matched > 0 ? 100 : 0,
    matched > 0
      ? `Observed ${matched} direct counterparty exposure(s) to the demo sanctions watchlist.`
      : "No direct counterparty exposure to the demo sanctions watchlist was provided.",
  );
};

export const sanctionedExposureRatioFeature: Feature = (ctx) => {
  const counterpartyCount = ctx.counterparties.length;
  const matched = matchedCounterparties(ctx).length;
  const ratio = counterpartyCount === 0 ? 0 : Math.round((matched / counterpartyCount) * 100);

  return result(
    "sanctioned_exposure_ratio",
    ratio,
    matched > 0
      ? `${matched} of ${counterpartyCount} counterparties appear on the demo sanctions watchlist.`
      : "No ratio-based sanctions exposure signal was observed.",
  );
};

export const counterpartyCountFeature: Feature = (ctx) => {
  const counterpartyCount = ctx.counterparties.length;
  const score = counterpartyCountScore(counterpartyCount);

  return result(
    "counterparty_count",
    score,
    `Observed ${counterpartyCount} known counterparty address(es).`,
  );
};

export const velocityFeature: Feature = async (ctx) => {
  const txCount = await resolveTxCount(ctx.address, ctx.signals, ctx.chain);
  const score = velocityScore(txCount);
  let reason = `Observed transaction count ${txCount}; velocity stayed below 10.`;

  if (score === 100) {
    reason = `Observed transaction count ${txCount}; velocity exceeded the high-risk threshold 25.`;
  } else if (score === 50) {
    reason = `Observed transaction count ${txCount}; velocity exceeded the medium-risk threshold 10.`;
  }

  return result("velocity", score, reason);
};

export const accountNewnessFeature: Feature = async (ctx) => {
  const txCount = await resolveTxCount(ctx.address, ctx.signals, ctx.chain);
  const score = accountNewnessScore(txCount);
  let reason = `Observed transaction count ${txCount}; account has enough history for the newness feature.`;

  if (score === 100) {
    reason = `Observed transaction count ${txCount}; account appears freshly active.`;
  } else if (score === 50) {
    reason = `Observed transaction count ${txCount}; account has limited history.`;
  }

  return result("account_newness", score, reason);
};

export async function extractFeatureResults(ctx: ScoringContext): Promise<FeatureResult[]> {
  const breakdown = await Promise.all(defaultFeatures.map(async (feature) => feature(ctx)));
  return breakdown;
}

export function isModelFeature(id: string): boolean {
  return FEATURE_NAMES.has(id as ReturnType<typeof getFeatureNames>[number]);
}

export const defaultFeatures = [
  sanctionedDirectFeature,
  sanctionedExposureFeature,
  sanctionedExposureRatioFeature,
  counterpartyCountFeature,
  velocityFeature,
  accountNewnessFeature,
] as const satisfies readonly Feature[];
