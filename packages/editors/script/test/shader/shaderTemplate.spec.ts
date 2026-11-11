// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SHADER_TEMPLATE } from "@jolly-pixel/asset.script";
import { loadShader } from "@jolly-pixel/scripting/three";
import * as THREE from "three/webgpu";

describe("shader template", () => {
  test("compiles the template of a new shader", async() => {
    const shader = await loadShader(SHADER_TEMPLATE, "shaders/Water.tsl.ts");

    assert.ok(shader.createMaterial().material instanceof THREE.MeshStandardNodeMaterial);
  });
});
