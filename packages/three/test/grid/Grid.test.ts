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
    assert.strictEqual(grid.showAxes, true);
    assert.strictEqual(grid.cellColor.value, "#393939");
    assert.strictEqual(grid.sectionColor.value, "#787878");
    assert.strictEqual(grid.xAxisColor.value, "#e54b4b");
    assert.strictEqual(grid.yAxisColor.value, "#4bc94b");
    assert.strictEqual(grid.zAxisColor.value, "#4b7bc9");
    assert.strictEqual(grid.enabled, true);
    assert.strictEqual(grid.visible, true);
    assert.strictEqual(grid.fade.from, "camera");
    assert.strictEqual(grid.followCamera, true);
    assert.strictEqual(grid.infiniteGrid, false);
  });

  test("fade: { from: \"origin\" } defaults followCamera to false", () => {
    const grid = new Grid({ fade: { from: "origin" } });

    assert.strictEqual(grid.fade.from, "origin");
    assert.strictEqual(grid.followCamera, false);
  });

  test("followCamera explicit option overrides the fade.from-derived default", () => {
    const grid = new Grid({ fade: { from: "origin" }, followCamera: true });

    assert.strictEqual(grid.followCamera, true);
  });

  test("throws Error when fade.from is \"target\" without a fade.target", () => {
    assert.throws(
      () => new Grid({ fade: { from: "target" } }),
      /GridFadeOptions\.target is required/
    );
  });

  test("fade: { from: \"target\", target } defaults followCamera to true and reflects fade.target", () => {
    const target = new THREE.Object3D();
    const grid = new Grid({ fade: { from: "target", target } });

    assert.strictEqual(grid.fade.from, "target");
    assert.strictEqual(grid.followCamera, true);
    assert.strictEqual(grid.fade.target, target);
  });

  test("enabled: false hides the grid from construction", () => {
    const grid = new Grid({ enabled: false });

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
    assert.strictEqual(grid.hideCellOnSection, true);
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

      assert.strictEqual(grid.cellColor.value, "#393939");
    }
    finally {
      Grid.Defaults.cell.color = original;
    }
  });

  test("constructor options still override a mutated Grid.Defaults value", () => {
    const original = Grid.Defaults.cell.size;
    try {
      Grid.Defaults.cell.size = 5;
      const grid = new Grid({ cell: { size: 9 } });

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

    assert.notStrictEqual(grid.plane, Grid.Defaults.plane);
    assert.strictEqual(grid.plane.value, Grid.Defaults.plane.value);
  });

  test("Grid instances clone Grid.Defaults.cell.style/section.style rather than sharing the instance", () => {
    const grid = new Grid();

    assert.notStrictEqual(grid.cellStyle, Grid.Defaults.cell.style);
    assert.notStrictEqual(grid.sectionStyle, Grid.Defaults.section.style);
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
      const grid = new Grid({ fade: { distance: 20 } });

      const params = (grid.geometry as THREE.PlaneGeometry).parameters;
      assert.strictEqual(params.width, 20);
    }
    finally {
      Grid.Defaults.extent.minimum = originalMinimum;
      Grid.Defaults.extent.fadeMultiplier = originalMultiplier;
    }
  });
});

describe("infiniteGrid", () => {
  test("defaults to false", () => {
    const grid = new Grid();

    assert.strictEqual(grid.infiniteGrid, false);
  });

  test("reflects the provided infiniteGrid option", () => {
    const grid = new Grid({ infiniteGrid: true });

    assert.strictEqual(grid.infiniteGrid, true);
  });

  test("uses a fixed 2x2 geometry instead of the extent-sized quad", () => {
    const bounded = new Grid();
    const infinite = new Grid({ infiniteGrid: true });

    const boundedParams = (bounded.geometry as THREE.PlaneGeometry).parameters;
    const infiniteParams = (infinite.geometry as THREE.PlaneGeometry).parameters;

    assert.notStrictEqual(boundedParams.width, 2);
    assert.strictEqual(infiniteParams.width, 2);
    assert.strictEqual(infiniteParams.height, 2);
  });

  test("extent option is ignored", () => {
    const grid = new Grid({ infiniteGrid: true, extent: 999 });

    const params = (grid.geometry as THREE.PlaneGeometry).parameters;
    assert.strictEqual(params.width, 2);
    assert.strictEqual(params.height, 2);
  });

  test("does not reposition on onBeforeRender (no camera-follow in infinite mode)", () => {
    const grid = new Grid({ infiniteGrid: true });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 6, -4);

    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);

    assert.strictEqual(grid.position.x, 0);
    assert.strictEqual(grid.position.y, 0);
    assert.strictEqual(grid.position.z, 0);
  });

  test("offset still round-trips live in infinite mode", () => {
    const grid = new Grid({ infiniteGrid: true });
    grid.offset = 3.5;

    assert.strictEqual(grid.offset, 3.5);
  });
});

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

      assert.strictEqual(grid[property].value, "#abcdef");
    });

    test(`setting "${property}.value" accepts a THREE.Color instance`, () => {
      const grid = new Grid();
      grid[property].value = new THREE.Color("#123456");

      assert.strictEqual(grid[property].value, "#123456");
    });
  }

  test("showAxes round-trips true/false", () => {
    const grid = new Grid();
    grid.showAxes = false;

    assert.strictEqual(grid.showAxes, false);

    grid.showAxes = true;
    assert.strictEqual(grid.showAxes, true);
  });

  test("enabled round-trips true/false and mirrors visible", () => {
    const grid = new Grid();
    grid.enabled = false;

    assert.strictEqual(grid.enabled, false);
    assert.strictEqual(grid.visible, false);

    grid.enabled = true;
    assert.strictEqual(grid.enabled, true);
    assert.strictEqual(grid.visible, true);
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
    assert.strictEqual(grid.followCamera, true);
  });

  test("hideCellOnSection round-trips true/false", () => {
    const grid = new Grid();
    grid.hideCellOnSection = true;

    assert.strictEqual(grid.hideCellOnSection, true);

    grid.hideCellOnSection = false;
    assert.strictEqual(grid.hideCellOnSection, false);
  });
});

describe("camera-following via onBeforeRender", () => {
  test("repositions the grid on its in-plane axes to match the camera", () => {
    const grid = new Grid({ plane: "xz" });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 6, -4);

    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);

    assert.strictEqual(grid.position.x, 10);
    assert.strictEqual(grid.position.y, 0);
    assert.strictEqual(grid.position.z, -4);
  });

  test("stays in sync across repeated calls as the camera moves", () => {
    const grid = new Grid({ plane: "xz" });
    const camera = new THREE.PerspectiveCamera();

    camera.position.set(1, 0, 1);
    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);
    assert.strictEqual(grid.position.x, 1);
    assert.strictEqual(grid.position.z, 1);

    camera.position.set(-9, 0, 3);
    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);
    assert.strictEqual(grid.position.x, -9);
    assert.strictEqual(grid.position.z, 3);
  });

  test("preserves the constructor offset across calls", () => {
    const grid = new Grid({ plane: "xz", offset: 2.5 });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 99, 1);

    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);

    assert.strictEqual(grid.position.y, 2.5);
  });

  test("followCamera: false keeps the grid pinned to the origin plane regardless of camera position", () => {
    const grid = new Grid({ plane: "xz", followCamera: false, offset: 3 });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 6, -4);

    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);

    assert.strictEqual(grid.position.x, 0);
    assert.strictEqual(grid.position.y, 3);
    assert.strictEqual(grid.position.z, 0);
  });

  test("followCamera can be toggled live", () => {
    const grid = new Grid({ plane: "xz" });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 0, 5);

    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);
    assert.strictEqual(grid.position.x, 5);
    assert.strictEqual(grid.position.z, 5);

    grid.followCamera = false;
    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);
    assert.strictEqual(grid.position.x, 0);
    assert.strictEqual(grid.position.z, 0);
  });
});

describe("target fade mode via onBeforeRender", () => {
  test("repositions the grid on its in-plane axes to match fade.target rather than the camera", () => {
    const target = new THREE.Object3D();
    target.position.set(3, 0, -7);

    const grid = new Grid({ plane: "xz", fade: { from: "target", target } });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 6, -4);

    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);

    assert.strictEqual(grid.position.x, 3);
    assert.strictEqual(grid.position.y, 0);
    assert.strictEqual(grid.position.z, -7);
  });

  test("follows fade.target's world position, not its local position", () => {
    const parent = new THREE.Object3D();
    parent.position.set(100, 0, 0);
    const target = new THREE.Object3D();
    target.position.set(3, 0, -7);
    parent.add(target);
    parent.updateMatrixWorld(true);

    const grid = new Grid({ plane: "xz", fade: { from: "target", target } });
    const camera = new THREE.PerspectiveCamera();

    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);

    assert.strictEqual(grid.position.x, 103);
    assert.strictEqual(grid.position.z, -7);
  });

  test("stays in sync across repeated calls as fade.target moves", () => {
    const target = new THREE.Object3D();
    const grid = new Grid({ plane: "xz", fade: { from: "target", target } });
    const camera = new THREE.PerspectiveCamera();

    target.position.set(1, 0, 1);
    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);
    assert.strictEqual(grid.position.x, 1);
    assert.strictEqual(grid.position.z, 1);

    target.position.set(-9, 0, 3);
    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);
    assert.strictEqual(grid.position.x, -9);
    assert.strictEqual(grid.position.z, 3);
  });

  test("followCamera: false keeps the grid pinned to the origin plane regardless of fade.target", () => {
    const target = new THREE.Object3D();
    target.position.set(3, 0, -7);

    const grid = new Grid({
      plane: "xz",
      fade: { from: "target", target },
      followCamera: false
    });
    const camera = new THREE.PerspectiveCamera();

    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);

    assert.strictEqual(grid.position.x, 0);
    assert.strictEqual(grid.position.z, 0);
  });

  test("fade.target can be swapped live and is followed on the next call", () => {
    const firstTarget = new THREE.Object3D();
    firstTarget.position.set(1, 0, 1);
    const secondTarget = new THREE.Object3D();
    secondTarget.position.set(-4, 0, 8);

    const grid = new Grid({ plane: "xz", fade: { from: "target", target: firstTarget } });
    const camera = new THREE.PerspectiveCamera();

    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);
    assert.strictEqual(grid.position.x, 1);
    assert.strictEqual(grid.position.z, 1);

    grid.fade.target = secondTarget;
    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);
    assert.strictEqual(grid.position.x, -4);
    assert.strictEqual(grid.position.z, 8);
  });

  test("falls back to the camera position once fade.target is cleared", () => {
    const target = new THREE.Object3D();
    target.position.set(1, 0, 1);

    const grid = new Grid({ plane: "xz", fade: { from: "target", target } });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 0, 5);

    grid.fade.target = null;
    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);

    assert.strictEqual(grid.position.x, 5);
    assert.strictEqual(grid.position.z, 5);
  });

  test("does not reposition on onBeforeRender in infinite mode, but still tracks fade.target's world position", () => {
    const target = new THREE.Object3D();
    target.position.set(3, 0, -7);

    const grid = new Grid({ infiniteGrid: true, fade: { from: "target", target } });
    const camera = new THREE.PerspectiveCamera();

    // @ts-expect-error onBeforeRender's unused params aren't exercised here
    grid.onBeforeRender(undefined, undefined, camera, undefined, undefined, undefined);

    assert.strictEqual(grid.position.x, 0);
    assert.strictEqual(grid.position.y, 0);
    assert.strictEqual(grid.position.z, 0);
  });
});
