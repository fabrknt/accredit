import { describe, expect, it } from "vitest";

import {
  accountNewnessFeature,
  sanctionedDirectFeature,
  sanctionedExposureFeature,
  velocityFeature,
} from "../src/features.js";
import type { Address, ScoringContext } from "../src/types.js";

const CLEAN_ADDRESS = "0x2222222222222222222222222222222222222222" as Address;
const WATCHLISTED_ADDRESS = "0x000000000000000000000000000000000000dead" as Address;

function makeContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    address: CLEAN_ADDRESS,
    counterparties: [],
    watchlist: new Set([WATCHLISTED_ADDRESS]),
    signals: { txCount: 5, hasCode: false },
    ...overrides,
  };
}

describe("features", () => {
  it("fires sanctioned_direct for a watchlisted address", async () => {
    const result = await sanctionedDirectFeature(makeContext({ address: WATCHLISTED_ADDRESS }));
    expect(result.score).toBe(100);
    expect(result.weight).toBe(60);
  });

  it("fires sanctioned_exposure for watchlisted counterparties", async () => {
    const result = await sanctionedExposureFeature(
      makeContext({ counterparties: [WATCHLISTED_ADDRESS, CLEAN_ADDRESS] }),
    );
    expect(result.score).toBe(100);
    expect(result.weight).toBe(25);
  });

  it("fires velocity at medium and high thresholds", async () => {
    const medium = await velocityFeature(makeContext({ signals: { txCount: 10 } }));
    const high = await velocityFeature(makeContext({ signals: { txCount: 25 } }));

    expect(medium.score).toBe(50);
    expect(high.score).toBe(100);
  });

  it("fires account_newness for fresh accounts", async () => {
    const high = await accountNewnessFeature(makeContext({ signals: { txCount: 1 } }));
    const medium = await accountNewnessFeature(makeContext({ signals: { txCount: 3 } }));

    expect(high.score).toBe(100);
    expect(medium.score).toBe(50);
  });
});
