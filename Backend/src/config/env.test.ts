import { describe, expect, it } from "vitest";
import { parseSightengineThresholds } from "./env";

describe("Sightengine threshold configuration", () => {
  it("provides every required category by default", () => {
    expect(Object.keys(parseSightengineThresholds())).toEqual([
      "nudity", "sexual", "violence", "gore", "weapons", "drugs",
      "alcohol", "tobacco", "offensiveSymbols"
    ]);
  });

  it("parses a complete valid JSON configuration", () => {
    const pair = { review: 0.2, block: 0.8 };
    const value = JSON.stringify({
      nudity: pair, sexual: pair, violence: pair, gore: pair, weapons: pair,
      drugs: pair, alcohol: pair, tobacco: pair, offensiveSymbols: pair
    });
    expect(parseSightengineThresholds(value).gore).toEqual(pair);
  });

  it.each([
    "not-json",
    JSON.stringify({ nudity: { review: 0.2, block: 0.8 } }),
    JSON.stringify({
      nudity: { review: 0.8, block: 0.8 }, sexual: { review: 0.2, block: 0.8 },
      violence: { review: 0.2, block: 0.8 }, gore: { review: 0.2, block: 0.8 },
      weapons: { review: 0.2, block: 0.8 }, drugs: { review: 0.2, block: 0.8 },
      alcohol: { review: 0.2, block: 0.8 }, tobacco: { review: 0.2, block: 0.8 },
      offensiveSymbols: { review: 0.2, block: 0.8 }
    })
  ])("rejects malformed or unsafe threshold configuration", (value) => {
    expect(() => parseSightengineThresholds(value)).toThrow();
  });
});
