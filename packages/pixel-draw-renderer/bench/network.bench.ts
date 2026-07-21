// Import Internal Dependencies
import {
  createBench,
  mulberry32,
  randomPositions,
  reportBench
} from "./_harness.ts";
import { applyCommandToWorld } from "../src/network/PixelCommandApplier.ts";
import { PixelWorld } from "../src/network/PixelWorld.ts";
import {
  LastWriteWinsResolver,
  type PixelConflictContext
} from "../src/network/ConflictResolver.ts";
import type {
  PixelNetworkCommand,
  PixelNetworkCommandHeader
} from "../src/network/types.ts";
import type { RGBA, Vec2 } from "../src/types.ts";

// CONSTANTS
const kSide = 256;
const kWhite: RGBA = { r: 255, g: 255, b: 255, a: 255 };
const kBlack: RGBA = { r: 0, g: 0, b: 0, a: 255 };
const kResolveBatch = 1000;

/**
 * Headless server-side command application: `applyCommandToWorld` for a stroke
 * and a full-canvas `global-fill` (matchAll + drawPixels + copyToMaster), plus
 * `LastWriteWinsResolver.resolve` throughput under mixed conflicts.
 */
export async function run(): Promise<void> {
  const bench = createBench("Network (network/*)");

  const rng = mulberry32();
  const size: Vec2 = { x: kSide, y: kSide };

  const strokeWorld = new PixelWorld();
  strokeWorld.addBuffer("stroke", { size, maxSize: kSide });
  const strokeCommand = header({
    action: "stroke",
    metadata: {
      color: kBlack,
      positions: randomPositions(256, size, rng)
    }
  }, "stroke");

  const fillWorld = new PixelWorld();
  const fillBuffer = fillWorld.addBuffer("fill", { size, maxSize: kSide });
  const whitePixels = new Uint8ClampedArray(kSide * kSide * 4).fill(255);
  const fillCommand = header({
    action: "global-fill",
    metadata: { fromColor: kWhite, toColor: kBlack }
  }, "fill");

  const resolver = new LastWriteWinsResolver();
  const contexts = buildResolveContexts(kResolveBatch, rng);

  bench
    .add("applyCommandToWorld / stroke (256 px)", () => {
      applyCommandToWorld(strokeWorld, strokeCommand);
    })
    .add("applyCommandToWorld / global-fill 256x256", () => {
      applyCommandToWorld(fillWorld, fillCommand);
    }, {
      // Fill recolors white -> black; reset to white before each iteration so
      // matchAll keeps hitting the whole canvas (worst case).
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

  await reportBench(bench);
}

function header(
  event: { action: string; metadata: unknown; },
  bufferId: string
): PixelNetworkCommand {
  return {
    ...event,
    bufferId,
    clientId: "bench-client",
    seq: 1,
    timestamp: 1
  } as PixelNetworkCommand;
}

function buildResolveContexts(
  count: number,
  rng: () => number
): PixelConflictContext[] {
  const contexts: PixelConflictContext[] = new Array(count);

  for (let i = 0; i < count; i++) {
    const incoming: PixelNetworkCommandHeader = {
      bufferId: "b",
      clientId: `c${Math.floor(rng() * 8)}`,
      seq: i,
      timestamp: Math.floor(rng() * 1000)
    };
    const existing: PixelNetworkCommandHeader | undefined = rng() < 0.5 ?
      undefined :
      {
        bufferId: "b",
        clientId: `c${Math.floor(rng() * 8)}`,
        seq: i,
        timestamp: Math.floor(rng() * 1000)
      };

    contexts[i] = { incoming, existing };
  }

  return contexts;
}

if (import.meta.main) {
  await run();
}
