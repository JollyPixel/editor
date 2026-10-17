// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { createHarness } from "./harness.ts";

describe("rendering", () => {
  test("visible meshes join the transparent pass", () => {
    const harness = createHarness({
      appearance: {
        center: { outline: { opacity: 1 } },
        outline: { opacity: 1 }
      }
    });
    harness.controls.mode = "rotate";
    harness.controls.mode = "scale";

    const names = new Set<string>();
    const opaque: string[] = [];
    harness.controls.helper.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      const material = object.material as THREE.Material;
      if (!material.visible) {
        return;
      }
      names.add(object.name);
      if (!material.transparent) {
        opaque.push(`${object.parent?.name}/${object.name}`);
      }
    });

    assert.deepEqual([...names].sort(), [
      "transform-handle-border",
      "transform-handle-outline",
      "transform-handle-visual",
      "transform-silhouette"
    ]);
    assert.deepEqual(opaque, []);

    harness.controls.dispose();
  });
});
