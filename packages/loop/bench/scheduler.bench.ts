// Import Third-party Dependencies
import {
  batched,
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { FrameScheduler } from "../src/index.ts";

// CONSTANTS
const kFrame60 = 1000 / 60;
const kFrame144 = 1000 / 144;
const kJitter = Array.from(
  { length: 256 },
  (_, index) => Math.sin(index * 12.9898) * 0.75
);

const suite = defineSuite("loop / FrameScheduler#advance", (bench) => {
  const steady = advancer(new FrameScheduler(), kFrame60);
  const highRefresh = advancer(new FrameScheduler(), kFrame144);
  const panicking = advancer(new FrameScheduler(), 200);
  const catchUp = advancer(
    new FrameScheduler({ maxStepsPerFrame: 240 }),
    200
  );
  const capped = advancer(new FrameScheduler({ maxFps: 60 }), kFrame144);
  const snapped = jitteredAdvancer(
    new FrameScheduler({ snapTolerance: 2 }),
    kFrame60
  );

  bench
    .add("steady 60Hz — one step per frame", batched(steady))
    .add("144Hz against 60Hz — mostly step-less frames", batched(highRefresh))
    .add("snapped 60Hz — jittery timestamps, snapTolerance 2", batched(snapped))
    .add("overloaded — budget hit, remainder dropped", batched(panicking))
    .add("catch-up — 12 steps per frame", batched(catchUp))
    .add("render capped — 60fps cap on a 144Hz source", batched(capped));
}, { opsPerIteration: "batch" });

export default suite;

function advancer(
  scheduler: FrameScheduler,
  deltaMs: number
): () => void {
  let now = 0;
  scheduler.advance(now);

  return function advance() {
    now += deltaMs;
    scheduler.advance(now);
  };
}

function jitteredAdvancer(
  scheduler: FrameScheduler,
  periodMs: number
): () => void {
  let frame = 0;
  scheduler.advance(0);

  return function advance() {
    frame++;
    scheduler.advance((frame * periodMs) + kJitter[frame % kJitter.length]);
  };
}

if (import.meta.main) {
  await runSuites([suite]);
}
