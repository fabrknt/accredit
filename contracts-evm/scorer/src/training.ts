// SPDX-License-Identifier: Apache-2.0
import type { TrainedModel, TrainingDataset, TrainingRow } from "./types.js";

const FEATURE_NAMES = [
  "sanctioned_exposure",
  "sanctioned_exposure_ratio",
  "counterparty_count",
  "velocity",
  "account_newness",
] as const;

const TRAINING_SPLIT = 0.8;
const COUNT_CAP = 20;
const DEFAULT_STD = 1;

type FeatureName = (typeof FEATURE_NAMES)[number];

interface SynthAccount {
  txCount: number;
  counterparties: number;
  matchedCounterparties: number;
}

interface NumericSplit {
  trainX: number[][];
  trainY: number[];
  holdoutX: number[][];
  holdoutY: number[];
}

export interface TrainingMetrics {
  accuracy: number;
  correct: number;
  total: number;
}

export interface TrainingOutcome {
  model: TrainedModel;
  metrics: TrainingMetrics;
}

export function getFeatureNames(): readonly FeatureName[] {
  return FEATURE_NAMES;
}

export function counterpartyCountScore(counterparties: number): number {
  const clamped = Math.max(0, Math.min(COUNT_CAP, counterparties));
  return Math.round((clamped / COUNT_CAP) * 100);
}

export function velocityScore(txCount: number): number {
  if (txCount >= 25) {
    return 100;
  }

  if (txCount >= 10) {
    return 50;
  }

  return 0;
}

export function accountNewnessScore(txCount: number): number {
  if (txCount <= 1) {
    return 100;
  }

  if (txCount <= 3) {
    return 50;
  }

  return 0;
}

export function synthesizeTrainingDataset(): TrainingDataset {
  const rng = createSeededRng(0xacced105);
  const rows: TrainingRow[] = [];

  for (let index = 0; index < 220; index += 1) {
    rows.push(buildRow(sampleBenignAccount(rng), 0));
  }

  for (let index = 0; index < 140; index += 1) {
    rows.push(buildRow(sampleIllicitAccount(rng), 1));
  }

  shuffleInPlace(rows, rng);

  return {
    datasetVersion: "2026-06-25-hackathon-curated-v1",
    note:
      "Representative curated dataset for the Horizon Hackathon. Rows are deterministically synthesized from realistic, overlapping heuristics and are not production ground truth.",
    distributions: {
      benign: [
        "Mostly zero sanctioned exposure, with rare low-ratio accidental overlap.",
        "Transaction counts cluster in established low-to-medium ranges, with some legitimate high-volume actors.",
        "Counterparty counts skew small-to-mid sized.",
      ],
      illicit: [
        "Sanctioned exposure ratios are materially higher, but still overlap benign outliers.",
        "Accounts skew either freshly active or bursty, producing stronger account-newness and velocity signals.",
        "Counterparty counts are broader and more spray-like.",
      ],
    },
    rows,
  };
}

export function trainLogisticModel(dataset: TrainingDataset): TrainingOutcome {
  const split = splitRows(dataset.rows);
  const stats = computeStats(split.trainX);
  const standardizedTrainX = standardizeMatrix(split.trainX, stats.mean, stats.std);

  const weights = new Array<number>(FEATURE_NAMES.length).fill(0);
  let bias = 0;

  const iterations = 4_000;
  const learningRate = 0.18;
  const l2Penalty = 0.0008;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradients = new Array<number>(weights.length).fill(0);
    let biasGradient = 0;

    for (let rowIndex = 0; rowIndex < standardizedTrainX.length; rowIndex += 1) {
      const features = standardizedTrainX[rowIndex] ?? [];
      const label = split.trainY[rowIndex] ?? 0;
      const probability = sigmoid(dot(weights, features) + bias);
      const error = probability - label;

      biasGradient += error;
      for (let featureIndex = 0; featureIndex < weights.length; featureIndex += 1) {
        gradients[featureIndex] = (gradients[featureIndex] ?? 0) + error * (features[featureIndex] ?? 0);
      }
    }

    const sampleCount = standardizedTrainX.length;
    for (let featureIndex = 0; featureIndex < weights.length; featureIndex += 1) {
      const weight = weights[featureIndex] ?? 0;
      const gradient = gradients[featureIndex] ?? 0;
      weights[featureIndex] = weight - learningRate * ((gradient / sampleCount) + l2Penalty * weight);
    }

    bias -= learningRate * (biasGradient / sampleCount);
  }

  const threshold = selectThreshold(standardizedTrainX, split.trainY, weights, bias);
  const model: TrainedModel = {
    version: "1.0.0",
    featureNames: [...FEATURE_NAMES],
    mean: stats.mean.map(roundNumber),
    std: stats.std.map(roundNumber),
    weights: weights.map(roundNumber),
    bias: roundNumber(bias),
    threshold: roundNumber(threshold),
  };

  const metrics = evaluateModel(model, split.holdoutX, split.holdoutY);

  return { model, metrics };
}

export function evaluateModel(model: TrainedModel, features: number[][], labels: number[]): TrainingMetrics {
  let correct = 0;

  for (let index = 0; index < features.length; index += 1) {
    const probability = predictProbability(model, features[index] ?? []);
    const predicted = probability >= model.threshold ? 1 : 0;
    const label = labels[index] ?? 0;
    if (predicted === label) {
      correct += 1;
    }
  }

  return {
    accuracy: correct / Math.max(1, features.length),
    correct,
    total: features.length,
  };
}

export function heldOutRows(dataset: TrainingDataset): readonly TrainingRow[] {
  return dataset.rows.slice(Math.floor(dataset.rows.length * TRAINING_SPLIT));
}

export function predictProbability(model: TrainedModel, rawFeatures: readonly number[]): number {
  const standardized = rawFeatures.map((value, index) => {
    const mean = model.mean[index] ?? 0;
    const std = model.std[index] ?? DEFAULT_STD;
    return std === 0 ? 0 : (value - mean) / std;
  });

  return sigmoid(dot(model.weights, standardized) + model.bias);
}

export function rowToVector(row: TrainingRow): number[] {
  return FEATURE_NAMES.map((featureName) => row.features[featureName] ?? 0);
}

export function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalStringify(entry)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildRow(account: SynthAccount, label: 0 | 1): TrainingRow {
  const ratio =
    account.counterparties === 0
      ? 0
      : Math.round((account.matchedCounterparties / account.counterparties) * 100);

  return {
    label,
    features: {
      sanctioned_exposure: account.matchedCounterparties > 0 ? 100 : 0,
      sanctioned_exposure_ratio: ratio,
      counterparty_count: counterpartyCountScore(account.counterparties),
      velocity: velocityScore(account.txCount),
      account_newness: accountNewnessScore(account.txCount),
    },
  };
}

function sampleBenignAccount(rng: () => number): SynthAccount {
  const txCount =
    rng() < 0.08
      ? sampleInt(rng, 25, 40)
      : sampleInt(rng, 4, 18) + (rng() < 0.2 ? sampleInt(rng, 0, 6) : 0);
  const counterparties = sampleInt(rng, 1, 10) + (rng() < 0.15 ? sampleInt(rng, 0, 6) : 0);
  const matchedCounterparties = rng() < 0.82 ? 0 : Math.min(counterparties, sampleInt(rng, 1, 2));

  return { txCount, counterparties, matchedCounterparties };
}

function sampleIllicitAccount(rng: () => number): SynthAccount {
  const txCount =
    rng() < 0.45 ? sampleInt(rng, 0, 3) : sampleInt(rng, 18, 45) + (rng() < 0.2 ? sampleInt(rng, 0, 10) : 0);
  const counterparties = sampleInt(rng, 4, 14) + (rng() < 0.35 ? sampleInt(rng, 2, 8) : 0);
  const minimumMatches = Math.max(1, Math.floor(counterparties * (0.12 + (rng() * 0.18))));
  const matchedCounterparties = Math.min(
    counterparties,
    minimumMatches + sampleInt(rng, 0, Math.max(1, Math.floor(counterparties * 0.45))),
  );

  return { txCount, counterparties, matchedCounterparties };
}

function splitRows(rows: readonly TrainingRow[]): NumericSplit {
  const splitIndex = Math.floor(rows.length * TRAINING_SPLIT);
  const trainRows = rows.slice(0, splitIndex);
  const holdoutRows = rows.slice(splitIndex);

  return {
    trainX: trainRows.map(rowToVector),
    trainY: trainRows.map((row) => row.label),
    holdoutX: holdoutRows.map(rowToVector),
    holdoutY: holdoutRows.map((row) => row.label),
  };
}

function computeStats(matrix: readonly number[][]): { mean: number[]; std: number[] } {
  const mean = new Array<number>(FEATURE_NAMES.length).fill(0);
  const std = new Array<number>(FEATURE_NAMES.length).fill(0);

  for (const row of matrix) {
    for (let index = 0; index < FEATURE_NAMES.length; index += 1) {
      mean[index] = (mean[index] ?? 0) + (row[index] ?? 0);
    }
  }

  for (let index = 0; index < FEATURE_NAMES.length; index += 1) {
    mean[index] = (mean[index] ?? 0) / Math.max(1, matrix.length);
  }

  for (const row of matrix) {
    for (let index = 0; index < FEATURE_NAMES.length; index += 1) {
      const centered = (row[index] ?? 0) - (mean[index] ?? 0);
      std[index] = (std[index] ?? 0) + (centered * centered);
    }
  }

  for (let index = 0; index < FEATURE_NAMES.length; index += 1) {
    const variance = (std[index] ?? 0) / Math.max(1, matrix.length);
    const deviation = Math.sqrt(variance);
    std[index] = deviation === 0 ? DEFAULT_STD : deviation;
  }

  return { mean, std };
}

function standardizeMatrix(matrix: readonly number[][], mean: readonly number[], std: readonly number[]): number[][] {
  return matrix.map((row) =>
    row.map((value, index) => {
      const deviation = std[index] ?? DEFAULT_STD;
      return deviation === 0 ? 0 : (value - (mean[index] ?? 0)) / deviation;
    }),
  );
}

function selectThreshold(
  standardizedTrainX: readonly number[][],
  labels: readonly number[],
  weights: readonly number[],
  bias: number,
): number {
  let bestThreshold = 0.5;
  let bestAccuracy = -1;

  for (let threshold = 0.3; threshold <= 0.7; threshold += 0.01) {
    let correct = 0;
    for (let rowIndex = 0; rowIndex < standardizedTrainX.length; rowIndex += 1) {
      const probability = sigmoid(dot(weights, standardizedTrainX[rowIndex] ?? []) + bias);
      const predicted = probability >= threshold ? 1 : 0;
      if (predicted === (labels[rowIndex] ?? 0)) {
        correct += 1;
      }
    }

    const accuracy = correct / Math.max(1, standardizedTrainX.length);
    if (accuracy > bestAccuracy) {
      bestAccuracy = accuracy;
      bestThreshold = threshold;
    }
  }

  return bestThreshold;
}

function dot(left: readonly number[], right: readonly number[]): number {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return sum;
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function roundNumber(value: number): number {
  return Number(value.toFixed(6));
}

function sampleInt(rng: () => number, min: number, max: number): number {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(rng() * (upper - lower + 1)) + lower;
}

function shuffleInPlace<T>(items: T[], rng: () => number): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = items[index];
    items[index] = items[swapIndex] as T;
    items[swapIndex] = current as T;
  }
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
