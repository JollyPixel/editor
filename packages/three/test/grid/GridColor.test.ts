// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { GridColor } from "#src/grid/GridColor.ts";

describe("GridColor", () => {
  test("value getter returns a normalized hex string", () => {
    const gridColor = new GridColor(new THREE.Color("#ABCDEF"));

    assert.strictEqual(gridColor.value, "#abcdef");
  });

  test("value setter accepts a hex string and round-trips", () => {
    const gridColor = new GridColor(new THREE.Color());
    gridColor.value = "#123456";

    assert.strictEqual(gridColor.value, "#123456");
  });

  test("value setter accepts a THREE.Color instance", () => {
    const gridColor = new GridColor(new THREE.Color());
    gridColor.value = new THREE.Color("#654321");

    assert.strictEqual(gridColor.value, "#654321");
  });

  test("mutates the wrapped THREE.Color instance in place", () => {
    const color = new THREE.Color("#000000");
    const gridColor = new GridColor(color);
    gridColor.value = "#ffffff";

    assert.strictEqual(`#${color.getHexString()}`, "#ffffff");
  });
});
