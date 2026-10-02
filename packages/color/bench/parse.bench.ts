// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { parseColor } from "../src/parse/index.ts";
import {
  BATCH,
  batchOf,
  byte,
  colorName,
  hexDigit,
  hexPair,
  rejectedInput
} from "./_fixtures.ts";

const suite = defineSuite("parse", (bench) => {
  const notations: Record<string, string[]> = {
    "hex #rgb": batchOf((rng) => `#${hexDigit(rng)}${hexDigit(rng)}${hexDigit(rng)}`),
    "hex #rrggbb": batchOf((rng) => `#${hexPair(rng)}${hexPair(rng)}${hexPair(rng)}`),
    "hex #rrggbbaa": batchOf(
      (rng) => `#${hexPair(rng)}${hexPair(rng)}${hexPair(rng)}${hexPair(rng)}`
    ),
    "hex uppercase, no hash": batchOf(
      (rng) => `${hexPair(rng)}${hexPair(rng)}${hexPair(rng)}`.toUpperCase()
    ),
    "hex padded": batchOf((rng) => `  #${hexPair(rng)}${hexPair(rng)}${hexPair(rng)} `),
    named: batchOf(colorName),
    "rgb() legacy": batchOf((rng) => `rgb(${byte(rng)}, ${byte(rng)}, ${byte(rng)})`),
    "rgb() modern alpha": batchOf(
      (rng) => `rgb(${byte(rng)} ${byte(rng)} ${byte(rng)} / ${(rng() * 100).toFixed(0)}%)`
    ),
    "rgba() percent": batchOf(
      (rng) => `rgba(${(rng() * 100).toFixed(1)}%, 50%, 25%, ${rng().toFixed(2)})`
    ),
    "hsl() legacy": batchOf(
      (rng) => `hsl(${byte(rng)}, ${byte(rng) % 101}%, ${byte(rng) % 101}%)`
    ),
    "hsl() turn": batchOf((rng) => `hsl(${rng().toFixed(3)}turn 40% 60%)`),
    "hwb()": batchOf((rng) => `hwb(${byte(rng)} ${byte(rng) % 50}% ${byte(rng) % 50}%)`),
    rejected: batchOf(rejectedInput)
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
