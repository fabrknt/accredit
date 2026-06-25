// SPDX-License-Identifier: Apache-2.0
import { keccak256, toBytes } from "viem";

import { extractFeatureResults, sanctionedDirectFeature } from "./features.js";
import modelData from "./model.json" with { type: "json" };
import { canonicalStringify, predictProbability } from "./training.js";
import type { FeatureResult, Hex, RiskBand, RiskResult, ScoringContext, TrainedModel } from "./types.js";

const ACTIVE_MODEL = modelData as TrainedModel;

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
  const contribution = feature.contribution ?? feature.weight * (feature.score / 100);
  return Number(contribution.toFixed(6));
}

export function modelRefFor(model: TrainedModel = ACTIVE_MODEL): Hex {
  return keccak256(toBytes(canonicalStringify(model)));
}

export function getActiveModel(): TrainedModel {
  return ACTIVE_MODEL;
}

export async function score(ctx: ScoringContext, model: TrainedModel = ACTIVE_MODEL): Promise<RiskResult> {
  const breakdown = await extractFeatureResults(ctx);
  const direct = await sanctionedDirectFeature(ctx);
  const modelBreakdown = annotateModelBreakdown(breakdown, model);
  const probability = predictProbability(
    model,
    model.featureNames.map((featureName) => findFeatureScore(breakdown, featureName)),
  );
  const modelScore = clampScore(probability * 100);
  const overridden = direct.score === 100;
  const scoreValue = overridden ? 100 : modelScore;
  const directBreakdown: FeatureResult = {
    ...direct,
    weight: overridden ? 1 : 0,
    contribution: overridden ? 100 : 0,
    standardized: overridden ? 1 : 0,
  };
  const reasons = buildReasons([directBreakdown, ...modelBreakdown], overridden);

  return {
    address: ctx.address,
    score: scoreValue,
    band: bandForScore(scoreValue),
    reasons,
    breakdown: [directBreakdown, ...modelBreakdown],
    modelRef: modelRefFor(model),
  };
}

function annotateModelBreakdown(features: readonly FeatureResult[], model: TrainedModel): FeatureResult[] {
  return model.featureNames.map((featureName, index) => {
    const feature = features.find((entry) => entry.id === featureName);
    const score = feature?.score ?? 0;
    const mean = model.mean[index] ?? 0;
    const std = model.std[index] ?? 1;
    const standardized = std === 0 ? 0 : (score - mean) / std;
    const weight = model.weights[index] ?? 0;

    return {
      id: featureName,
      score,
      standardized: Number(standardized.toFixed(6)),
      contribution: Number((standardized * weight).toFixed(6)),
      weight,
      reason: feature?.reason ?? `${featureName} was missing from the extracted feature vector.`,
    };
  });
}

function buildReasons(breakdown: readonly FeatureResult[], overridden: boolean): string[] {
  if (overridden) {
    return [breakdown[0]?.reason ?? "Address appears on the demo sanctions watchlist."];
  }

  return breakdown
    .filter((feature, index) => index !== 0 && Math.abs(featureContribution(feature)) >= 0.05)
    .sort((left, right) => Math.abs(featureContribution(right)) - Math.abs(featureContribution(left)))
    .map((feature) => {
      const direction = featureContribution(feature) >= 0 ? "Increased" : "Reduced";
      return `${direction} risk: ${feature.reason}`;
    });
}

function findFeatureScore(features: readonly FeatureResult[], featureName: string): number {
  const feature = features.find((entry) => entry.id === featureName);
  return feature?.score ?? 0;
}
