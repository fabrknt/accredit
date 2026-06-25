// SPDX-License-Identifier: Apache-2.0
import type { Address, ChainReader, Feature, FeatureResult, ScoringContext } from "./types.js";

const VELOCITY_MEDIUM_THRESHOLD = 10;
const VELOCITY_HIGH_THRESHOLD = 25;
const ACCOUNT_NEW_HIGH_THRESHOLD = 1;
const ACCOUNT_NEW_MEDIUM_THRESHOLD = 3;

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

function hasWatchlistMatch(watchlist: Set<Address>, candidates: readonly Address[]): boolean {
  return candidates.some((candidate) => watchlist.has(normalizeAddress(candidate)));
}

function result(id: string, weight: number, score: number, reason: string): FeatureResult {
  return { id, weight, score, reason };
}

export const sanctionedDirectFeature: Feature = (ctx) => {
  const matched = hasWatchlistMatch(ctx.watchlist, [ctx.address]);
  return result(
    "sanctioned_direct",
    60,
    matched ? 100 : 0,
    matched
      ? "Address appears on the demo sanctions watchlist."
      : "Address does not appear on the demo sanctions watchlist.",
  );
};

export const sanctionedExposureFeature: Feature = (ctx) => {
  const matchedCounterparties = ctx.counterparties.filter((counterparty) =>
    ctx.watchlist.has(normalizeAddress(counterparty)),
  );

  return result(
    "sanctioned_exposure",
    25,
    matchedCounterparties.length > 0 ? 100 : 0,
    matchedCounterparties.length > 0
      ? `Observed ${matchedCounterparties.length} direct counterparty exposure(s) to the demo sanctions watchlist.`
      : "No direct counterparty exposure to the demo sanctions watchlist was provided.",
  );
};

export const velocityFeature: Feature = async (ctx) => {
  const txCount = await resolveTxCount(ctx.address, ctx.signals, ctx.chain);
  let score = 0;
  let reason = `Observed transaction count ${txCount}; velocity stayed below ${VELOCITY_MEDIUM_THRESHOLD}.`;

  if (txCount >= VELOCITY_HIGH_THRESHOLD) {
    score = 100;
    reason = `Observed transaction count ${txCount}; velocity exceeded the high-risk threshold ${VELOCITY_HIGH_THRESHOLD}.`;
  } else if (txCount >= VELOCITY_MEDIUM_THRESHOLD) {
    score = 50;
    reason = `Observed transaction count ${txCount}; velocity exceeded the medium-risk threshold ${VELOCITY_MEDIUM_THRESHOLD}.`;
  }

  return result("velocity", 10, score, reason);
};

export const accountNewnessFeature: Feature = async (ctx) => {
  const txCount = await resolveTxCount(ctx.address, ctx.signals, ctx.chain);
  let score = 0;
  let reason = `Observed transaction count ${txCount}; account has enough history for the newness feature.`;

  if (txCount <= ACCOUNT_NEW_HIGH_THRESHOLD) {
    score = 100;
    reason = `Observed transaction count ${txCount}; account appears freshly active.`;
  } else if (txCount <= ACCOUNT_NEW_MEDIUM_THRESHOLD) {
    score = 50;
    reason = `Observed transaction count ${txCount}; account has limited history.`;
  }

  return result("account_newness", 5, score, reason);
};

export const defaultFeatures = [
  sanctionedDirectFeature,
  sanctionedExposureFeature,
  velocityFeature,
  accountNewnessFeature,
] as const satisfies readonly Feature[];
