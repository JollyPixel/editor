// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Grid } from "#src/index.ts";

describe("accessors", () => {
  const kNumericProperties = [
    "cellSize",
    "sectionSize",
    "cellThickness",
    "sectionThickness",
    "crossSize",
    "hideCellOnSectionFadeWidth",
    "fadeDistance",
    "fadeStrength",
    "axisThickness",
    "offset"
  ] as const;

  for (const property of kNumericProperties) {
    test(`setting "${property}" round-trips through its getter`, () => {
      const grid = new Grid();
      grid[property] = 42;

      assert.strictEqual(grid[property], 42);
    });
  }

  const kColorProperties = [
    "cellColor",
    "sectionColor",
    "xAxisColor",
    "yAxisColor",
    "zAxisColor"
  ] as const;

  for (const property of kColorProperties) {
    test(`setting "${property}.value" with a hex string round-trips as normalized hex`, () => {
      const grid = new Grid();
      grid[property].value = "#abcdef";

      assert.strictEqual(
        grid[property].value,
        "#abcdef"
      );
    });

    test(`setting "${property}.value" accepts a THREE.Color instance`, () => {
      const grid = new Grid();
      grid[property].value = new THREE.Color("#123456");

      assert.strictEqual(
        grid[property].value,
        "#123456"
      );
    });
  }

  test("showAxes round-trips true/false", () => {
    const grid = new Grid();
    grid.showAxes = false;

    assert.strictEqual(grid.showAxes, false);

    grid.showAxes = true;
    assert.ok(grid.showAxes);
  });

  test("enabled round-trips true/false and mirrors visible", () => {
    const grid = new Grid();
    grid.enabled = false;

    assert.strictEqual(grid.enabled, false);
    assert.strictEqual(grid.visible, false);

    grid.enabled = true;
    assert.ok(grid.enabled);
    assert.ok(grid.visible);
  });

  test("setting visible directly is reflected by enabled", () => {
    const grid = new Grid();
    grid.visible = false;

    assert.strictEqual(grid.enabled, false);
  });

  test("followCamera round-trips true/false", () => {
    const grid = new Grid();
    grid.followCamera = false;

    assert.strictEqual(grid.followCamera, false);

    grid.followCamera = true;
    assert.ok(grid.followCamera);
  });

  test("hideCellOnSection round-trips true/false", () => {
    const grid = new Grid();
    grid.hideCellOnSection = true;

    assert.ok(grid.hideCellOnSection);

    grid.hideCellOnSection = false;
    assert.strictEqual(grid.hideCellOnSection, false);
  });
});

describe("dispose", () => {
  test("disposes the geometry and material", () => {
    const grid = new Grid();
    let geometryDisposed = false;
    let materialDisposed = false;
    grid.geometry.dispose = () => {
      geometryDisposed = true;
    };
    const { material } = grid;
    assert.ok(!Array.isArray(material));
    material.dispose = () => {
      materialDisposed = true;
    };

    grid.dispose();

    assert.ok(geometryDisposed);
    assert.ok(materialDisposed);
  });

  test("disposes every material when Grid.material is an array", () => {
    const grid = new Grid();
    let firstDisposed = false;
    let secondDisposed = false;
    const { material } = grid;
    assert.ok(!Array.isArray(material));
    grid.material = [
      Object.assign(material, {
        dispose: () => {
          firstDisposed = true;
        }
      }),
      Object.assign(material.clone(), {
        dispose: () => {
          secondDisposed = true;
        }
      })
    ];

    grid.dispose();

    assert.ok(firstDisposed);
    assert.ok(secondDisposed);
  });
});
