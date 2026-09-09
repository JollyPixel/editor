// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Grid } from "#src/index.ts";

describe("toOptions()", () => {
  test("round-trips every option given to the constructor", () => {
    const target = new THREE.Object3D();
    const grid = new Grid({
      plane: "xy",
      extent: 64,
      cell: {
        style: "cross",
        size: 2,
        color: "#010203",
        thickness: 3
      },
      section: {
        style: "cross",
        size: 8,
        color: "#040506",
        thickness: 4
      },
      crossSize: 0.4,
      hideCellOnSection: true,
      hideCellOnSectionFadeWidth: 1.5,
      fade: {
        from: "target",
        target,
        distance: 42,
        strength: 2
      },
      axes: {
        show: false,
        thickness: 5,
        xColor: "#070809",
        yColor: "#0a0b0c",
        zColor: "#0d0e0f"
      },
      offset: 1.25,
      enabled: false,
      followCamera: false,
      infiniteGrid: false
    });

    assert.deepStrictEqual(grid.toOptions(), {
      plane: "xy",
      extent: 64,
      cell: {
        style: "cross",
        size: 2,
        color: "#010203",
        thickness: 3
      },
      section: {
        style: "cross",
        size: 8,
        color: "#040506",
        thickness: 4
      },
      crossSize: 0.4,
      hideCellOnSection: true,
      hideCellOnSectionFadeWidth: 1.5,
      fade: {
        from: "target",
        target,
        distance: 42,
        strength: 2
      },
      axes: {
        show: false,
        thickness: 5,
        xColor: "#070809",
        yColor: "#0a0b0c",
        zColor: "#0d0e0f"
      },
      offset: 1.25,
      enabled: false,
      followCamera: false,
      infiniteGrid: false
    });
  });

  test("reports live property mutations", () => {
    const grid = new Grid();
    grid.cellSize = 7;
    grid.showAxes = false;
    grid.enabled = false;

    const options = grid.toOptions();

    assert.strictEqual(options.cell?.size, 7);
    assert.strictEqual(options.axes?.show, false);
    assert.strictEqual(options.enabled, false);
  });

  test("omits an absent fade target", () => {
    const options = new Grid().toOptions();

    assert.strictEqual(options.fade?.target, undefined);
  });
});

describe("cloneWith()", () => {
  test("carries over every option the overrides do not name", () => {
    const grid = new Grid({
      extent: 32,
      cell: {
        size: 3,
        color: "#010203"
      },
      offset: 2
    });
    const derived = grid.cloneWith({ plane: "yz" });

    assert.strictEqual(derived.plane.value, "yz");
    assert.strictEqual(derived.extent, 32);
    assert.strictEqual(derived.cellSize, 3);
    assert.strictEqual(derived.offset, 2);
  });

  test("merges a nested group instead of replacing it", () => {
    const grid = new Grid({
      cell: {
        style: "lines",
        size: 3,
        thickness: 4
      }
    });
    const derived = grid.cloneWith({ cell: { style: "cross" } });

    assert.strictEqual(derived.cellStyle.value, "cross");
    assert.strictEqual(derived.cellSize, 3);
    assert.strictEqual(derived.cellThickness, 4);
  });

  test("leaves the source grid untouched", () => {
    const grid = new Grid({ cell: { size: 3 } });
    grid.cloneWith({ cell: { size: 9 } });

    assert.strictEqual(grid.cellSize, 3);
  });

  test("keeps the fade target across a rebuild", () => {
    const target = new THREE.Object3D();
    const grid = new Grid({
      fade: {
        from: "target",
        target
      }
    });
    const derived = grid.cloneWith({ fade: { distance: 10 } });

    assert.strictEqual(derived.fade.target, target);
    assert.strictEqual(derived.fadeDistance, 10);
  });
});
