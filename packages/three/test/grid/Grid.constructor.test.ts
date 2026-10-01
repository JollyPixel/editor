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
      // @ts-expect-error
      () => new Grid({ plane: "invalid" }),
      /Invalid plane "invalid"/
    );
  });

  test("plane defaults to \"xz\"", () => {
    const grid = new Grid();

    assert.strictEqual(grid.plane.value, "xz");
  });

  test("throws Error for invalid cellStyle", () => {
    assert.throws(
      // @ts-expect-error
      () => new Grid({ cell: { style: "invalid" } }),
      /Invalid cellStyle "invalid"/
    );
  });

  test("throws Error for invalid sectionStyle", () => {
    assert.throws(
      // @ts-expect-error
      () => new Grid({ section: { style: "invalid" } }),
      /Invalid sectionStyle "invalid"/
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
    assert.ok(grid.showSection);
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
      /GridFadeOptions\.target is required when fade\.from is "target"/
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

  test("Grid.Defaults.section.show controls section visibility", () => {
    const original = Grid.Defaults.section.show;
    try {
      Grid.Defaults.section.show = false;
      const grid = new Grid();

      assert.strictEqual(grid.showSection, false);
    }
    finally {
      Grid.Defaults.section.show = original;
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
      Grid.Defaults.extent.fadeMultiplier = 2;
      const scaled = new Grid({
        fade: { distance: 20 }
      });
      const floored = new Grid({
        fade: { distance: 2 }
      });

      assert.strictEqual(scaled.geometry.parameters.width, 40);
      assert.strictEqual(floored.geometry.parameters.width, 10);
    }
    finally {
      Grid.Defaults.extent.minimum = originalMinimum;
      Grid.Defaults.extent.fadeMultiplier = originalMultiplier;
    }
  });
});
