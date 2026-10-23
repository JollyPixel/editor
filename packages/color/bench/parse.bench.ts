// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { parseColor } from "../src/parse/index.ts";
import {
  BATCH,
  createBatch,
  byte,
  colorName,
  hexDigit,
  hexPair,
  rejectedInput
} from "./_fixtures.ts";

const suite = defineSuite("parse", (bench) => {
  const notations: Record<string, string[]> = {
    "hex #rgb": createBatch((rng) => `#${hexDigit(rng)}${hexDigit(rng)}${hexDigit(rng)}`),
    "hex #rrggbb": createBatch((rng) => `#${hexPair(rng)}${hexPair(rng)}${hexPair(rng)}`),
    "hex #rrggbbaa": createBatch(
      (rng) => `#${hexPair(rng)}${hexPair(rng)}${hexPair(rng)}${hexPair(rng)}`
    ),
    "hex uppercase, no hash": createBatch(
      (rng) => `${hexPair(rng)}${hexPair(rng)}${hexPair(rng)}`.toUpperCase()
    ),
    "hex padded": createBatch((rng) => `  #${hexPair(rng)}${hexPair(rng)}${hexPair(rng)} `),
    named: createBatch(colorName),
    "rgb() legacy": createBatch((rng) => `rgb(${byte(rng)}, ${byte(rng)}, ${byte(rng)})`),
    "rgb() modern alpha": createBatch(
      (rng) => `rgb(${byte(rng)} ${byte(rng)} ${byte(rng)} / ${(rng() * 100).toFixed(0)}%)`
    ),
    "rgba() percent": createBatch(
      (rng) => `rgba(${(rng() * 100).toFixed(1)}%, 50%, 25%, ${rng().toFixed(2)})`
    ),
    "hsl() legacy": createBatch(
      (rng) => `hsl(${byte(rng)}, ${byte(rng) % 101}%, ${byte(rng) % 101}%)`
    ),
    "hsl() turn": createBatch((rng) => `hsl(${rng().toFixed(3)}turn 40% 60%)`),
    "hwb()": createBatch((rng) => `hwb(${byte(rng)} ${byte(rng) % 50}% ${byte(rng) % 50}%)`),
    "oklch()": createBatch(
      (rng) => `oklch(${(rng() * 100).toFixed(1)}% ${(rng() * 0.37).toFixed(3)} ${byte(rng)})`
    ),
    rejected: createBatch(rejectedInput)
  };

  for (const [name, inputs] of Object.entries(notations)) {
    bench.add(name, () => {
      let sum = 0;
      for (const input of inputs) {
        sum += parseColor(input)?.r ?? 0;
      }

      return sum;
    });
  }
}, { opsPerIteration: BATCH });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
