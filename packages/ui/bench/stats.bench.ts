// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { resolveMetricRange } from "../src/stats/MetricDefinition.ts";
import { StatsRecorder } from "../src/stats/StatsRecorder.ts";
import {
  BATCH,
  batchOf
} from "./_fixtures.ts";

// CONSTANTS
const kHistorySize = 60;

const suite = defineSuite("stats", (bench) => {
  const history = batchOf((rng) => rng() * 33).slice(0, kHistorySize);
  const bounded = {
    id: "ms",
    label: "MS",
    min: 0,
    max: 200
  };
  const automatic = {
    id: "mb",
    label: "MB"
  };

  let now = 0;
  const recorder = new StatsRecorder({
    historySize: kHistorySize,
    performance: {
      now: () => now
    }
  });
  for (let frame = 0; frame < kHistorySize * 20; frame++) {
    recorder.begin();
    now += 16;
    recorder.end();
  }

  bench
    .add("resolveMetricRange bounded", () => {
      let sum = 0;
      for (let index = 0; index < BATCH; index++) {
        sum += resolveMetricRange(bounded, history).max;
      }

      return sum;
    })
    .add("resolveMetricRange automatic", () => {
      let sum = 0;
      for (let index = 0; index < BATCH; index++) {
        sum += resolveMetricRange(automatic, history).max;
      }

      return sum;
    })
    .add("history full window", () => {
      let sum = 0;
      for (let index = 0; index < BATCH; index++) {
        sum += recorder.history("ms").length;
      }

      return sum;
    })
    .add("frame begin and end", () => {
      for (let index = 0; index < BATCH; index++) {
        recorder.begin();
        now += 16;
        recorder.end();
      }
    });
}, { opsPerIteration: BATCH });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
