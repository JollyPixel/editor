// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Grid, GridPlaneValue } from "#src/index.ts";

describe("constructor", () => {
  test("throws Error for invalid plane", () => {
    assert.throws(
      // @ts-expect-error Testing invalid plane
      () => new Grid({ plane: "invalid" }),
      /Invalid plane/
    );
  });

  test("plane defaults to \"xz\"", () => {
    const grid = new Grid();

    assert.strictEqual(grid.plane.value, "xz");
  });

  test("plane reflects the provided plane", () => {
    const grid = new Grid({ plane: "yz" });

    assert.strictEqual(grid.plane.value, "yz");
  });

  test("throws Error for invalid cellStyle", () => {
    assert.throws(
      // @ts-expect-error Testing invalid cellStyle
      () => new Grid({ cell: { style: "invalid" } }),
      /Invalid cellStyle/
    );
  });

  test("throws Error for invalid sectionStyle", () => {
    assert.throws(
      // @ts-expect-error Testing invalid sectionStyle
      () => new Grid({ section: { style: "invalid" } }),
      /Invalid sectionStyle/
    );
  });

  test("cellStyle/sectionStyle default to \"lines\"", () => {
    const grid = new Grid();

    assert.strictEqual(grid.cellStyle.value, "lines");
    assert.strictEqual(grid.sectionStyle.value, "lines");
  });

  test("cellStyle/sectionStyle reflect the provided style independently", () => {
    const grid = new Grid({
      cell: { style: "cross" },
      section: { style: "lines" }
    });

    assert.strictEqual(grid.cellStyle.value, "cross");
    assert.strictEqual(grid.sectionStyle.value, "lines");
  });

  test("frustumCulled is always false", () => {
    const grid = new Grid();

    assert.strictEqual(grid.frustumCulled, false);
  });

  test("is an instance of THREE.Mesh", () => {
    const grid = new Grid();

    assert.ok(grid instanceof THREE.Mesh);
  });

  test("applies documented defaults", () => {
    const grid = new Grid();

    assert.strictEqual(grid.cellSize, 1);
    assert.strictEqual(grid.sectionSize, 10);
    assert.strictEqual(grid.cellThickness, 1);
    assert.strictEqual(grid.sectionThickness, 2);
    assert.strictEqual(grid.crossSize, 0.2);
    assert.strictEqual(grid.hideCellOnSection, false);
    assert.strictEqual(grid.hideCellOnSectionFadeWidth, 0.5);
    assert.strictEqual(grid.fadeDistance, 100);
    assert.strictEqual(grid.fadeStrength, 1);
    assert.strictEqual(grid.axisThickness, 2);
    assert.strictEqual(grid.offset, 0);
    assert.ok(grid.showAxes);
    assert.strictEqual(grid.cellColor.value, "#393939");
    assert.strictEqual(grid.sectionColor.value, "#787878");
    assert.strictEqual(grid.xAxisColor.value, "#e54b4b");
    assert.strictEqual(grid.yAxisColor.value, "#4bc94b");
    assert.strictEqual(grid.zAxisColor.value, "#4b7bc9");
    assert.ok(grid.enabled);
    assert.ok(grid.visible);
    assert.strictEqual(grid.fade.from, "camera");
    assert.ok(grid.followCamera);
    assert.strictEqual(grid.infiniteGrid, false);
  });

  test("fade: { from: \"origin\" } defaults followCamera to false", () => {
    const grid = new Grid({
      fade: { from: "origin" }
    });

    assert.strictEqual(grid.fade.from, "origin");
    assert.strictEqual(grid.followCamera, false);
  });

  test("followCamera explicit option overrides the fade.from-derived default", () => {
    const grid = new Grid({
      fade: { from: "origin" },
      followCamera: true
    });

    assert.ok(grid.followCamera);
  });

  test("throws Error when fade.from is \"target\" without a fade.target", () => {
    assert.throws(
      () => new Grid({ fade: { from: "target" } }),
      /GridFadeOptions\.target is required/
    );
  });

  test("fade: { from: \"target\", target } defaults followCamera to true and reflects fade.target", () => {
    const target = new THREE.Object3D();
    const grid = new Grid({
      fade: {
        from: "target",
        target
      }
    });

    assert.strictEqual(grid.fade.from, "target");
    assert.ok(grid.followCamera);
    assert.strictEqual(grid.fade.target, target);
  });

  test("enabled: false hides the grid from construction", () => {
    const grid = new Grid({
      enabled: false
    });

    assert.strictEqual(grid.enabled, false);
    assert.strictEqual(grid.visible, false);
  });

  test("constructor options override every default", () => {
    const grid = new Grid({
      plane: "xy",
      cell: {
        style: "cross",
        size: 2,
        color: "#111111",
        thickness: 3
      },
      section: {
        style: "cross",
        size: 8,
        color: "#222222",
        thickness: 4
      },
      crossSize: 0.3,
      hideCellOnSection: true,
      hideCellOnSectionFadeWidth: 1.5,
      fade: {
        from: "origin",
        distance: 50,
        strength: 2
      },
      axes: {
        show: false,
        thickness: 5,
        xColor: "#ff0000",
        yColor: "#00ff00",
        zColor: "#0000ff"
      },
      offset: 7
    });

    assert.strictEqual(grid.plane.value, "xy");
    assert.strictEqual(grid.cellStyle.value, "cross");
    assert.strictEqual(grid.sectionStyle.value, "cross");
    assert.strictEqual(grid.cellSize, 2);
    assert.strictEqual(grid.sectionSize, 8);
    assert.strictEqual(grid.cellColor.value, "#111111");
    assert.strictEqual(grid.sectionColor.value, "#222222");
    assert.strictEqual(grid.cellThickness, 3);
    assert.strictEqual(grid.sectionThickness, 4);
    assert.strictEqual(grid.crossSize, 0.3);
    assert.ok(grid.hideCellOnSection);
    assert.strictEqual(grid.hideCellOnSectionFadeWidth, 1.5);
    assert.strictEqual(grid.fade.from, "origin");
    assert.strictEqual(grid.fadeDistance, 50);
    assert.strictEqual(grid.fadeStrength, 2);
    assert.strictEqual(grid.showAxes, false);
    assert.strictEqual(grid.axisThickness, 5);
    assert.strictEqual(grid.xAxisColor.value, "#ff0000");
    assert.strictEqual(grid.yAxisColor.value, "#00ff00");
    assert.strictEqual(grid.zAxisColor.value, "#0000ff");
    assert.strictEqual(grid.offset, 7);
  });
});

describe("Grid.Defaults", () => {
  test("new Grid() falls back to a mutated Grid.Defaults value", () => {
    const original = Grid.Defaults.cell.size;
    try {
      Grid.Defaults.cell.size = 5;
      const grid = new Grid();

      assert.strictEqual(grid.cellSize, 5);
    }
    finally {
      Grid.Defaults.cell.size = original;
    }
  });

  test("mutating Grid.Defaults does not affect already-constructed instances", () => {
    const original = Grid.Defaults.cell.color;
    try {
      const grid = new Grid();
      Grid.Defaults.cell.color = "#ff00ff";

      assert.strictEqual(
        grid.cellColor.value,
        "#393939"
      );
    }
    finally {
      Grid.Defaults.cell.color = original;
    }
  });

  test("constructor options still override a mutated Grid.Defaults value", () => {
    const original = Grid.Defaults.cell.size;
    try {
      Grid.Defaults.cell.size = 5;
      const grid = new Grid({
        cell: { size: 9 }
      });

      assert.strictEqual(grid.cellSize, 9);
    }
    finally {
      Grid.Defaults.cell.size = original;
    }
  });

  test("Grid.Defaults.plane can be replaced with a validated GridPlaneValue", () => {
    const original = Grid.Defaults.plane;
    try {
      Grid.Defaults.plane = new GridPlaneValue("xy");
      const grid = new Grid();

      assert.strictEqual(grid.plane.value, "xy");
    }
    finally {
      Grid.Defaults.plane = original;
    }
  });

  test("Grid instances clone Grid.Defaults.plane rather than sharing the instance", () => {
    const grid = new Grid();

    assert.notStrictEqual(
      grid.plane,
      Grid.Defaults.plane
    );
    assert.strictEqual(
      grid.plane.value,
      Grid.Defaults.plane.value
    );
  });

  test("Grid instances clone Grid.Defaults.cell.style/section.style rather than sharing the instance", () => {
    const grid = new Grid();

    assert.notStrictEqual(
      grid.cellStyle,
      Grid.Defaults.cell.style
    );
    assert.notStrictEqual(
      grid.sectionStyle,
      Grid.Defaults.section.style
    );
  });

  test("Grid.Defaults.fade.from is used when GridOptions.fade.from is omitted", () => {
    const original = Grid.Defaults.fade.from;
    try {
      Grid.Defaults.fade.from = "origin";
      const grid = new Grid();

      assert.strictEqual(grid.fade.from, "origin");
    }
    finally {
      Grid.Defaults.fade.from = original;
    }
  });

  test("Grid.Defaults.extent.minimum/fadeMultiplier drive the derived extent", () => {
    const originalMinimum = Grid.Defaults.extent.minimum;
    const originalMultiplier = Grid.Defaults.extent.fadeMultiplier;
    try {
      Grid.Defaults.extent.minimum = 10;
      Grid.Defaults.extent.fadeMultiplier = 1;
      const grid = new Grid({
        fade: { distance: 20 }
      });

      const params = grid.geometry.parameters;
      assert.strictEqual(params.width, 20);
    }
    finally {
      Grid.Defaults.extent.minimum = originalMinimum;
      Grid.Defaults.extent.fadeMultiplier = originalMultiplier;
    }
  });
});
