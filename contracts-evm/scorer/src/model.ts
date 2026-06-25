// SPDX-License-Identifier: Apache-2.0
import { keccak256, toBytes } from "viem";

import { defaultFeatures } from "./features.js";
import type { FeatureResult, Hex, ModelConfig, RiskBand, RiskResult, ScoringContext } from "./types.js";

export const DEFAULT_MODEL_ID = "transparent-weighted-scorer";
export const DEFAULT_MODEL_VERSION = "1.0.0";

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  modelId: DEFAULT_MODEL_ID,
  version: DEFAULT_MODEL_VERSION,
  features: defaultFeatures,
};

export function clampScore(score: number): number {
  const rounded = Math.round(score);
  return Math.max(0, Math.min(100, rounded));
}

export function bandForScore(score: number): RiskBand {
  if (score >= 50) {
    return "high";
  }

  if (score >= 25) {
    return "medium";
  }

  return "low";
}

export function featureContribution(feature: FeatureResult): number {
  return Math.round((feature.weight * feature.score) / 100);
}

export function modelRefFor(config: Pick<ModelConfig, "modelId" | "version">): Hex {
  return keccak256(toBytes(`accredit-aml/${config.modelId}@${config.version}`));
}

export async function score(
  ctx: ScoringContext,
  config: ModelConfig = DEFAULT_MODEL_CONFIG,
): Promise<RiskResult> {
  const breakdown = await Promise.all(config.features.map(async (feature) => feature(ctx)));
  const total = clampScore(breakdown.reduce((sum, feature) => sum + featureContribution(feature), 0));
  const reasons = breakdown.filter((feature) => feature.score > 0).map((feature) => feature.reason);

  return {
    address: ctx.address,
    score: total,
    band: bandForScore(total),
    reasons,
    breakdown,
    modelRef: modelRefFor(config),
  };
}
