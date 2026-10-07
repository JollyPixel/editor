// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { randomColor } from "./_fixtures.ts";
import { groupPositionsByColor } from "../src/buffer/colorGroups.ts";
import type { RGBA8, Vec2 } from "../src/types.ts";

// CONSTANTS
const kGroupCount = 4096;

/**
 * Benchmarks `groupPositionsByColor`, which builds the inverse of every stroke.
 * Grouping cost scales with distinct color count.
 */
const suite = defineSuite("Undo grouping (buffer/colorGroups)", (bench) => {
  const rng = mulberry32();
  const fewColors = buildGroupInput(kGroupCount, 4, rng);
  const manyColors = buildGroupInput(kGroupCount, kGroupCount, rng);

  bench
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
