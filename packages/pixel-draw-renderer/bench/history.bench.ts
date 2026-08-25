// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  randomColor,
  randomPositions
} from "./_fixtures.ts";
import { PixelBuffer } from "../src/buffer/PixelBuffer.ts";
import { HistoryStack } from "../src/history/HistoryStack.ts";
import { groupPositionsByColor } from "../src/buffer/colorGroups.ts";
import { UVMap } from "../src/uv/UVMap.ts";
import type { HistoryStrokeEntry } from "../src/history/HistoryStack.types.ts";
import type { RGBA8, Vec2 } from "../src/types.ts";

// CONSTANTS
const kSide = 256;
const kGroupCount = 4096;

/**
 * Benchmarks undo/redo replay and `groupPositionsByColor`.
 * Grouping cost scales with distinct color count.
 */
const suite = defineSuite("History (history/HistoryStack)", (bench) => {
  const rng = mulberry32();
  const buffer = new PixelBuffer({
    size: { x: kSide, y: kSide },
    maxSize: kSide
  });
  const uvMap = new UVMap({
    getCanvasSize() {
      return { x: kSide, y: kSide };
    }
  });
  const history = new HistoryStack(buffer, uvMap);

  const positions = randomPositions(256, { x: kSide, y: kSide }, rng);
  const strokeEntry: Omit<HistoryStrokeEntry, "timestamp"> = {
    action: "stroke",
    positions,
    beforeColors: positions.map(() => randomColor(rng)),
    afterColor: { r: 0, g: 0, b: 0, a: 255 }
  };

  const fewColors = buildGroupInput(kGroupCount, 4, rng);
  const manyColors = buildGroupInput(kGroupCount, kGroupCount, rng);

  bench
    .add("push -> undo -> redo / 256-px stroke", () => {
      history.push(strokeEntry);
      history.undo();
      history.redo();
    })
    .add("groupPositionsByColor / 4096 px, 4 colors", () => {
      groupPositionsByColor(fewColors.positions, fewColors.colors);
    })
    .add("groupPositionsByColor / 4096 px, all distinct", () => {
      groupPositionsByColor(manyColors.positions, manyColors.colors);
    });
});

export default suite;

function buildGroupInput(
  count: number,
  distinctColors: number,
  rng: () => number
): { positions: Vec2[]; colors: RGBA8[]; } {
  const palette = Array.from(
    { length: distinctColors },
    () => randomColor(rng)
  );

  const positions: Vec2[] = new Array(count);
  const colors: RGBA8[] = new Array(count);
  for (let i = 0; i < count; i++) {
    positions[i] = { x: i, y: 0 };
    colors[i] = palette[i % palette.length];
  }

  return { positions, colors };
}

if (import.meta.main) {
  await runSuites([suite]);
}
