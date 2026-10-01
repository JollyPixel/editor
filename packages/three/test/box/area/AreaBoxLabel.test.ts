// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AreaBoxLabel } from "#src/index.ts";
import { contextOf } from "../../fixtures/canvas.ts";
import { watchDisposal } from "../../fixtures/disposal.ts";

describe("constructor", () => {
  test("draws the outlined display name", () => {
    const label = new AreaBoxLabel({ displayName: "Spawn" });
    const context = contextOf(label);

    assert.equal(context.lastStrokeText, "Spawn");
    assert.equal(context.lastFillText, "Spawn");
    assert.equal(
      new THREE.Color(label.color).getHexString(),
      "ffffff"
    );
  });
});

describe("live properties", () => {
  test("redraws after the display name or color changes", () => {
    const label = new AreaBoxLabel({ displayName: "Spawn" });
    const context = contextOf(label);
    const callsBefore = context.fillTextCallCount;

    label.displayName = "Patrol";
    label.color = "#4da3ff";

    assert.equal(label.displayName, "Patrol");
    assert.equal(context.lastFillText, "Patrol");
    assert.equal(context.fillTextCallCount, callsBefore + 2);
  });
});

describe("dispose", () => {
  test("releases the texture and material", () => {
    const label = new AreaBoxLabel({ displayName: "Spawn" });
    const { map } = label.material;
    assert.ok(map);
    const disposals = watchDisposal(map, label.material);

    label.dispose();

    assert.deepEqual(disposals, [1, 1]);
  });
});
