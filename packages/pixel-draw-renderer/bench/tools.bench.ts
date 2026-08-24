// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { PixelBuffer } from "../src/buffer/PixelBuffer.ts";
import { Line } from "../src/tools/Line.ts";
import { Brush } from "../src/tools/Brush.ts";
import { Select } from "../src/tools/Select.ts";
import { ShapeSelect } from "../src/tools/ShapeSelect.ts";
import { traceSelectionContour } from "../src/rendering/overlays/selectionContour.ts";
import type { RGBA } from "../src/types.ts";

// CONSTANTS
const kSide = 256;
const kWhite: RGBA = { r: 255, g: 255, b: 255, a: 255 };

/**
 * Covers geometry and selection helpers used during interactive editing.
 */
const suite = defineSuite("Tools (tools/*)", (bench) => {
  const brush1 = new Brush({ size: 1 });
  const brush8 = new Brush({ size: 8 });
  const brush32 = new Brush({ size: 32 });
  const buffer = new PixelBuffer({
    size: { x: kSide, y: kSide },
    defaultColor: kWhite,
    maxSize: kSide
  });
  const snapshot = new Array<RGBA>(kSide * kSide).fill(kWhite);
  const mask = new Array<boolean>(kSide * kSide).fill(false);
  for (let y = 16; y < 240; y++) {
    for (let x = 16; x < 240; x++) {
      const insideHole = x >= 96 && x < 160 && y >= 96 && y < 160;
      mask[(y * kSide) + x] = !insideHole;
    }
  }

  bench
    .add("Brush.affectedPixels / 1x1", () => {
      let count = 0;
      for (const _pixel of brush1.affectedPixels(128, 128)) {
        count++;
      }

      return count;
    })
    .add("Brush.affectedPixels / 8x8", () => {
      let count = 0;
      for (const _pixel of brush8.affectedPixels(128, 128)) {
        count++;
      }

      return count;
    })
    .add("Brush.affectedPixels / 32x32", () => {
      let count = 0;
      for (const _pixel of brush32.affectedPixels(128, 128)) {
        count++;
      }

      return count;
    })
    .add(
      "BrushColor.asRGBA / cached snapshot",
      () => brush32.primary.asRGBA().a
    )
    .add(
      "Line.rasterize / 512-px diagonal",
      () => Line.rasterize(
        { x: 0, y: 0 },
        { x: 511, y: 511 }
      )
    )
    .add(
      "ShapeSelect.compute / uniform 256x256",
      () => ShapeSelect.compute(buffer, { x: 128, y: 128 })
    )
    .add(
      "Select.captureSnapshot / 256x256",
      () => Select.captureSnapshot(
        buffer,
        { x: 0, y: 0, width: kSide, height: kSide }
      )
    )
    .add(
      "Select.rotateSnapshotCW / 256x256",
      () => Select.rotateSnapshotCW(snapshot, kSide, kSide)
    )
    .add(
      "traceSelectionContour / rectangle with hole 256x256",
      () => traceSelectionContour(kSide, kSide, mask)
    );
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
