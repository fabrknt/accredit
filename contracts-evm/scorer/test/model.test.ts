import { describe, expect, it } from "vitest";

import { defaultFeatures } from "../src/features.js";
import {
  bandForScore,
  clampScore,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_VERSION,
  featureContribution,
  modelRefFor,
  score,
} from "../src/model.js";
import type { Address, Feature, FeatureResult, ScoringContext } from "../src/types.js";
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

function fixedFeature(id: string, weight: number, rawScore: number): Feature {
  return (): FeatureResult => ({
    id,
    weight,
    score: rawScore,
    reason: `${id} fired`,
  });
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

  it("produces a stable 32-byte modelRef", () => {
    const modelRef = modelRefFor({ modelId: DEFAULT_MODEL_ID, version: DEFAULT_MODEL_VERSION });
    expect(modelRef).toMatch(/^0x[0-9a-f]{64}$/);
    expect(modelRef).toBe("0xa605e19646d125a3d75b65c6b041bb22eed13f7907d11320de05ac591ec5ba64");
  });

  it("scores a watchlisted address as high risk", async () => {
    const result = await score(makeContext({ address: WATCHLISTED_ADDRESS }), {
      modelId: DEFAULT_MODEL_ID,
      version: DEFAULT_MODEL_VERSION,
      features: defaultFeatures,
    });

    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.band).toBe("high");
  });

  it("scores a clean address as low risk", async () => {
    const result = await score(
      makeContext({
        address: CLEAN_ADDRESS,
        counterparties: [],
        signals: { txCount: 6, hasCode: false },
      }),
    );

    expect(result.score).toBeLessThan(25);
    expect(result.band).toBe("low");
  });

  it("aggregates feature contributions deterministically", async () => {
    const result = await score(makeContext(), {
      modelId: "test",
      version: "1",
      features: [fixedFeature("a", 24, 100), fixedFeature("b", 26, 100)],
    });

    const first = result.breakdown[0];
    const second = result.breakdown[1];

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(featureContribution(first as FeatureResult)).toBe(24);
    expect(featureContribution(second as FeatureResult)).toBe(26);
    expect(result.score).toBe(50);
    expect(result.band).toBe("high");
  });

  it("clamps the aggregated total to 100", async () => {
    const result = await score(makeContext(), {
      modelId: "overflow",
      version: "1",
      features: [fixedFeature("overflow", 150, 100)],
    });

    expect(result.score).toBe(100);
  });
});
