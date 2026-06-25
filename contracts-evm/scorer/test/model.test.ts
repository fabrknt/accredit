import { describe, expect, it } from "vitest";

import {
  bandForScore,
  clampScore,
  featureContribution,
  getActiveModel,
  modelRefFor,
  score,
} from "../src/model.js";
import trainingData from "../data/training.json" with { type: "json" };
import { canonicalStringify, evaluateModel, heldOutRows, rowToVector } from "../src/training.js";
import type { Address, ScoringContext, TrainingDataset } from "../src/types.js";
import watchlistData from "../src/watchlist.json" with { type: "json" };

const CLEAN_ADDRESS = "0x2222222222222222222222222222222222222222" as Address;
const WATCHLISTED_ADDRESS = "0x000000000000000000000000000000000000dead" as Address;

function makeContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    address: CLEAN_ADDRESS,
    counterparties: [],
    watchlist: new Set(watchlistData.map((entry) => entry.toLowerCase() as Address)),
    signals: { txCount: 12, hasCode: false },
    ...overrides,
  };
}

describe("model", () => {
  it("maps 24/25 and 49/50 to the correct bands", () => {
    expect(bandForScore(24)).toBe("low");
    expect(bandForScore(25)).toBe("medium");
    expect(bandForScore(49)).toBe("medium");
    expect(bandForScore(50)).toBe("high");
  });

  it("clamps scores at 0 and 100", () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(105)).toBe(100);
  });

  it("produces a stable 32-byte modelRef from canonical model.json", () => {
    const model = getActiveModel();
    const ref = modelRefFor(model);

    expect(canonicalStringify(model)).toContain("\"featureNames\"");
    expect(ref).toMatch(/^0x[0-9a-f]{64}$/);
    expect(ref).toBe(modelRefFor());
  });

  it("scores a clearly illicit vector as high risk", async () => {
    const result = await score(
      makeContext({
        counterparties: [
          WATCHLISTED_ADDRESS,
          WATCHLISTED_ADDRESS,
          CLEAN_ADDRESS,
          CLEAN_ADDRESS,
          CLEAN_ADDRESS,
          CLEAN_ADDRESS,
        ],
        signals: { txCount: 30, hasCode: false },
      }),
    );

    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.band).toBe("high");
  });

  it("scores a clearly benign vector as low risk", async () => {
    const result = await score(
      makeContext({
        counterparties: [CLEAN_ADDRESS, CLEAN_ADDRESS],
        signals: { txCount: 6, hasCode: false },
      }),
    );

    expect(result.score).toBeLessThan(25);
    expect(result.band).toBe("low");
  });

  it("forces sanctioned_direct to 100 regardless of the model", async () => {
    const result = await score(
      makeContext({
        address: WATCHLISTED_ADDRESS,
        counterparties: [],
        signals: { txCount: 0, hasCode: false },
      }),
    );

    expect(result.score).toBe(100);
    expect(result.band).toBe("high");
    expect(result.reasons[0]).toContain("watchlist");
  });

  it("keeps final score clamped to 0..100", async () => {
    const result = await score(
      makeContext({
        counterparties: new Array(40).fill(WATCHLISTED_ADDRESS) as Address[],
        signals: { txCount: 99, hasCode: false },
      }),
    );

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("surfaces sign-aware feature contributions", async () => {
    const result = await score(
      makeContext({
        counterparties: [WATCHLISTED_ADDRESS, CLEAN_ADDRESS, CLEAN_ADDRESS, CLEAN_ADDRESS],
        signals: { txCount: 18, hasCode: false },
      }),
    );

    const exposure = result.breakdown.find((feature) => feature.id === "sanctioned_exposure_ratio");
    expect(exposure).toBeDefined();
    expect(featureContribution(exposure!)).not.toBe(0);
  });

  it("reports held-out accuracy above 0.8", () => {
    const dataset = trainingData as TrainingDataset;
    const holdout = heldOutRows(dataset);
    const metrics = evaluateModel(
      getActiveModel(),
      holdout.map(rowToVector),
      holdout.map((row) => row.label),
    );

    expect(metrics.total).toBeGreaterThan(0);
    expect(metrics.accuracy).toBeGreaterThan(0.8);
  });
});
