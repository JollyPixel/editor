// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { SampleRing } from "../src/monitors/SampleRing.ts";
import {
  BATCH,
  batchOf
} from "./_fixtures.ts";

// CONSTANTS
const kSamples = 60;

const suite = defineSuite("graph / SampleRing", (bench) => {
  const values = batchOf((rng) => rng() * 120);
  const ring = new SampleRing();
  for (let index = 0; index < kSamples; index++) {
    ring.push(values[index], kSamples);
  }

  bench
    .add("push full window", () => {
      for (const value of values) {
        ring.push(value, kSamples);
      }
    })
    .add("push and auto-scale", () => {
      let sum = 0;
      for (const value of values) {
        ring.push(value, kSamples);
        sum += ring.max() - ring.min();
      }

      return sum;
    });
}, { opsPerIteration: BATCH });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
