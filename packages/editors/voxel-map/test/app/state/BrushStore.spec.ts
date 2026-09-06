// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { BrushStore } from "../../../src/app/state/index.ts";
import {
  DEFAULT_BRUSH_STYLE,
  type BrushStyle
} from "../../../src/features/painting/model/BrushStyle.ts";

describe("BrushStore", () => {
  it("publishes a patched style once", () => {
    const brush = new BrushStore();
    const styles: BrushStyle[] = [];
    brush.watch("styleChange", (style) => styles.push(style));

    brush.applyStyle({ edgeStyle: "dashed" });
    brush.applyStyle({ edgeStyle: "dashed" });

    assert.equal(styles.length, 1);
    assert.equal(brush.style.edgeStyle, "dashed");
    assert.equal(brush.style.opacity, DEFAULT_BRUSH_STYLE.opacity);
  });

  it("ignores a style member it cannot use", () => {
    const brush = new BrushStore();

    brush.applyStyle({ opacity: Number.NaN });

    assert.equal(brush.style.opacity, DEFAULT_BRUSH_STYLE.opacity);
  });

  it("clamps the size to its bounds instead of throwing", () => {
    const brush = new BrushStore();
    const sizes: number[] = [];
    brush.watch("sizeChange", (size) => sizes.push(size));

    brush.size = 0;
    brush.size = 5;
    brush.size = 99;
    brush.resize(-2);

    assert.deepEqual(sizes, [5, 8, 6]);
    assert.equal(brush.size, 6);
  });

  it("publishes block, rotation and flip changes only on transition", () => {
    const brush = new BrushStore();
    const seen: string[] = [];
    brush.watch("blockChange", (id) => seen.push(`block:${id}`));
    brush.watch("rotationModeChange", (mode) => seen.push(`rotation:${mode}`));
    brush.watch("flipYChange", (flipY) => seen.push(`flipY:${flipY}`));

    brush.blockId = 4;
    brush.blockId = 4;
    brush.rotationMode = "auto";
    brush.flipY = true;
    brush.flipY = true;

    assert.deepEqual(seen, ["block:4", "flipY:true"]);
  });
});
