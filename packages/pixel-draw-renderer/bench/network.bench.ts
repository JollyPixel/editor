// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  randomPositions
} from "./_fixtures.ts";
import { applyCommandToBuffer } from "../src/network/PixelCommandApplier.ts";
import { PixelBuffer } from "../src/buffer/PixelBuffer.ts";
import type { PixelNetworkCommand } from "../src/network/types.ts";
import type { RGBA, Vec2 } from "../src/types.ts";

// CONSTANTS
const kSide = 256;
const kWhite: RGBA = { r: 255, g: 255, b: 255, a: 255 };
const kBlack: RGBA = { r: 0, g: 0, b: 0, a: 255 };
const kResolveBatch = 1000;

/**
 * Benchmarks command application (`stroke`, `global-fill`) and
 * `LastWriteWinsResolver.resolve` under mixed conflicts.
 */
const suite = defineSuite("Network (network/*)", (bench) => {
  const rng = mulberry32();
  const size: Vec2 = { x: kSide, y: kSide };

  const strokeBuffer = new PixelBuffer({ size, maxSize: kSide });
  const strokeCommand = header({
    action: "stroke",
    metadata: {
      color: kBlack,
      positions: randomPositions(256, size, rng)
    }
  });

  const fillBuffer = new PixelBuffer({ size, maxSize: kSide });
  const whitePixels = new Uint8ClampedArray(kSide * kSide * 4).fill(255);
  const fillCommand = header({
    action: "global-fill",
    metadata: { fromColor: kWhite, toColor: kBlack }
  });

  const resolver = new network.LastWriteWinsResolver();
  const contexts = buildResolveContexts(kResolveBatch, rng);

  bench
    .add("applyCommandToBuffer / stroke (256 px)", () => {
      applyCommandToBuffer(strokeBuffer, strokeCommand);
    })
    .add("applyCommandToBuffer / global-fill 256x256", () => {
      applyCommandToBuffer(fillBuffer, fillCommand);
    }, {
      // Reset white before each run so `global-fill` keeps worst-case coverage.
      beforeEach() {
        fillBuffer.replacePixels(whitePixels, size);
      }
    })
    .add(`LastWriteWinsResolver.resolve / x${kResolveBatch}`, () => {
      let accepted = 0;
      for (const ctx of contexts) {
        if (resolver.resolve(ctx) === "accept") {
          accepted++;
        }
      }

      return accepted;
    });
});

export default suite;

function header(
  event: { action: string; metadata: unknown; }
): PixelNetworkCommand {
  return {
    ...event,
    clientId: "bench-client",
    seq: 1,
    timestamp: 1
  } as PixelNetworkCommand;
}

function buildResolveContexts(
  count: number,
  rng: () => number
): network.ConflictContext[] {
  const contexts: network.ConflictContext[] = new Array(count);

  for (let i = 0; i < count; i++) {
    const incoming: network.NetworkCommandHeader = {
      clientId: `c${Math.floor(rng() * 8)}`,
      seq: i,
      timestamp: Math.floor(rng() * 1000)
    };
    const existing: network.NetworkCommandHeader | undefined = rng() < 0.5 ?
      undefined :
      {
        clientId: `c${Math.floor(rng() * 8)}`,
        seq: i,
        timestamp: Math.floor(rng() * 1000)
      };

    contexts[i] = { incoming, existing };
  }

  return contexts;
}

if (import.meta.main) {
  await runSuites([suite]);
}
