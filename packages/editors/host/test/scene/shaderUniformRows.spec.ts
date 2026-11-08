// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  TEXTURE_ASSET,
  type Shader
} from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { shaderUniformRows } from "#src/scene/shaderUniformRows.ts";

describe("shaderUniformRows", () => {
  it("offers one row per declared uniform, showing its default while the data has none", () => {
    const shader: Shader = {
      uniforms: {
        speed: 1.5,
        tint: new THREE.Color("#ff8800"),
        offset: new THREE.Vector2(1, 2),
        plane: new THREE.Vector4(0, 1, 0, 3),
        map: new THREE.Texture()
      },
      createMaterial: () => {
        return {
          material: new THREE.MeshBasicMaterial(),
          assign: () => undefined
        };
      }
    };

    assert.deepEqual(shaderUniformRows(shader), [
      { control: "number", path: ["uniforms", "speed"], label: "speed", step: 0.01, fallback: 1.5 },
      { control: "color", path: ["uniforms", "tint"], label: "tint", fallback: "#ff8800" },
      {
        control: "vector",
        path: ["uniforms", "offset"],
        label: "offset",
        step: 0.01,
        size: 2,
        fallback: { x: 1, y: 2 }
      },
      {
        control: "vector",
        path: ["uniforms", "plane"],
        label: "plane",
        step: 0.01,
        size: 4,
        fallback: { x: 0, y: 1, z: 0, w: 3 }
      },
      { control: "asset", slot: "texture:map", label: "map", type: TEXTURE_ASSET }
    ]);
    assert.deepEqual(shaderUniformRows(null), []);
  });
});
