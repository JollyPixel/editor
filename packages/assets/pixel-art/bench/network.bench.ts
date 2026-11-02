// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";
import {
  PixelBuffer,
  PixelDocumentState,
  type RGBA8,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  randomPositions
} from "./_fixtures.ts";
import { applyPixelCommand } from "../src/network/arbiter/PixelCommandApplier.ts";
import type { PixelNetworkCommand } from "../src/network/protocol/types.ts";

// CONSTANTS
const kSide = 256;
const kWhite: RGBA8 = { r: 255, g: 255, b: 255, a: 255 };
const kBlack: RGBA8 = { r: 0, g: 0, b: 0, a: 255 };

const suite = defineSuite("Network (network/*)", (bench) => {
  const rng = mulberry32();
  const size: Vec2 = { x: kSide, y: kSide };

  const strokeState = new PixelDocumentState({
    buffer: new PixelBuffer({ size, maxSize: kSide })
  });
  const strokeCommand = header({
    action: "stroke",
    metadata: {
      color: kBlack,
      positions: randomPositions(256, size, rng)
    }
  });

  const fillState = new PixelDocumentState({
    buffer: new PixelBuffer({ size, maxSize: kSide })
  });
  const whitePixels = new Uint8ClampedArray(kSide * kSide * 4).fill(255);
  const fillCommand = header({
    action: "global-fill",
    metadata: { fromColor: kWhite, toColor: kBlack }
  });

  bench
    .add("applyPixelCommand / stroke (256 px)", () => {
      applyPixelCommand(strokeState, strokeCommand);
    })
    .add("applyPixelCommand / global-fill 256x256", () => {
      applyPixelCommand(fillState, fillCommand);
    }, {
      beforeEach() {
        fillState.buffer.replacePixels(whitePixels, size);
      }
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

if (import.meta.main) {
  await runSuites([suite]);
}
