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
import { History } from "../src/history/History.ts";
import type { HistoryEdit } from "../src/history/HistoryEntry.ts";
import { groupPositionsByColor } from "../src/buffer/colorGroups.ts";
import { PixelDocumentState } from "../src/sync/PixelDocumentState.ts";
import {
  strokeOf,
  strokesOf
} from "../src/sync/PixelCommand.ts";
import type { RGBA8, Vec2 } from "../src/types.ts";

// CONSTANTS
const kSide = 256;
const kGroupCount = 4096;

/**
 * Benchmarks undo/redo replay and `groupPositionsByColor`.
 * Grouping cost scales with distinct color count.
 */
const suite = defineSuite("History (history/History)", (bench) => {
  const rng = mulberry32();
  const state = new PixelDocumentState({
    buffer: new PixelBuffer({
      size: { x: kSide, y: kSide },
      maxSize: kSide
    })
  });
  const history = new History({ enabled: true });

  const positions = randomPositions(256, { x: kSide, y: kSide }, rng);
  const strokeEdit: HistoryEdit = {
    redo: [strokeOf(positions, { r: 0, g: 0, b: 0, a: 255 })],
    undo: strokesOf(positions, positions.map(() => randomColor(rng)))
  };

  const fewColors = buildGroupInput(kGroupCount, 4, rng);
  const manyColors = buildGroupInput(kGroupCount, kGroupCount, rng);

  bench
    .add("push -> undo -> redo / 256-px stroke", () => {
      history.push(strokeEdit);
      history.undo((entry) => entry.undo.forEach((command) => state.apply(command)));
      history.redo((entry) => entry.redo.forEach((command) => state.apply(command)));
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

  const positions: Vec2[] = [];
  const colors: RGBA8[] = [];
  for (let i = 0; i < count; i++) {
    positions[i] = { x: i, y: 0 };
    colors[i] = palette[i % palette.length];
  }

  return { positions, colors };
}

if (import.meta.main) {
  await runSuites([suite]);
}
