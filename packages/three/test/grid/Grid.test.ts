// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Grid } from "#src/index.ts";

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
    assert.strictEqual(grid.fadeFrom, "camera");
    assert.strictEqual(grid.followCamera, true);
  });

  test("fade: { from: \"origin\" } defaults followCamera to false", () => {
    const grid = new Grid({ fade: { from: "origin" } });

    assert.strictEqual(grid.fadeFrom, "origin");
    assert.strictEqual(grid.followCamera, false);
  });

  test("followCamera explicit option overrides the fade.from-derived default", () => {
    const grid = new Grid({ fade: { from: "origin" }, followCamera: true });

    assert.strictEqual(grid.followCamera, true);
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
    assert.strictEqual(grid.fadeFrom, "origin");
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
