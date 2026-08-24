// Import Internal Dependencies
import {
  createBench,
  batched,
  kBatch,
  reportBench
} from "./_harness.ts";
import {
  FrameBudget,
  GameLoop,
  Interpolated,
  ManualClock,
  ManualFrameSource,
  lerpNumber
} from "../src/index.ts";

// CONSTANTS
// Read results land here so V8 cannot elide the calls being measured.
const kSink = { value: 0 };

/**
 * Measures dispatch, interpolation, and budget-check costs.
 */
export async function run(): Promise<void> {
  const bench = createBench("loop / primitives");

  const source = new ManualFrameSource();
  const loop = new GameLoop({ source });
  loop.start({
    fixedUpdate: () => void 0,
    update: () => void 0
  });

  const value = new Interpolated(0, lerpNumber).push(1);
  const clock = new ManualClock();
  const budget = new FrameBudget(clock).start(4);

  bench
    .add("GameLoop frame — one step, dispatched", batched(() => {
      source.step(1000 / 60);
    }))
    .add("Interpolated#at() — between the endpoints", batched(() => {
      kSink.value += value.at(0.5);
    }))
    .add("Interpolated#push()", batched(() => {
      value.push(1);
    }))
    .add("FrameBudget#expired", batched(() => {
      kSink.value += budget.expired ? 1 : 0;
    }));

  await reportBench(bench, kBatch);
  loop.stop();
}

if (import.meta.main) {
  await run();
}
