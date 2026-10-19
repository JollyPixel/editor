// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { HighlightMask } from "#src/mesh-highlight/postprocess/HighlightMask.ts";
import {
  RecordingRenderer,
  createEntriesOfEveryShape,
  createMesh
} from "./helpers.ts";

function createMaskScene() {
  const renderer = new RecordingRenderer();
  const scene = new THREE.Scene();
  const meshes = {
    plain: createMesh(),
    priority: createMesh(),
    isolated: createMesh()
  };
  scene.add(meshes.plain, meshes.priority, meshes.isolated);
  const mask = new HighlightMask(
    renderer as unknown as THREE.WebGPURenderer,
    scene,
    new THREE.PerspectiveCamera()
  );
  mask.entries = [
    {
      target: meshes.plain,
      color: "#ff0000"
    },
    {
      target: meshes.priority,
      color: "#00ff00",
      priority: true
    },
    {
      target: meshes.isolated,
      color: "#0000ff",
      isolated: true
    }
  ];

  return { renderer, scene, meshes, mask };
}

function summarizeDraws(
  { renderer, meshes, mask }: ReturnType<typeof createMaskScene>
) {
  const targets = new Map<THREE.RenderTarget | null, string>([
    [mask.shared, "shared"],
    [mask.priority, "priority"],
    [mask.isolated, "isolated"]
  ]);
  const objects = new Map<THREE.Object3D, string>(
    Object.entries(meshes).map(([name, mesh]) => [mesh, name])
  );

  return renderer.draws.map(({ target, object, material }) => [
    targets.get(target),
    objects.get(object),
    material.depthTest ? "depth" : "onTop"
  ]);
}

describe("render", () => {
  test("draws every entry into the mask targets its flags select", () => {
    const harness = createMaskScene();

    assert.strictEqual(harness.mask.render(), true);

    assert.deepStrictEqual(summarizeDraws(harness), [
      ["shared", "plain", "depth"],
      ["shared", "priority", "depth"],
      ["shared", "priority", "onTop"],
      ["priority", "priority", "onTop"],
      ["isolated", "isolated", "onTop"]
    ]);
  });

  test("leaves the isolated target untouched when it is not due", () => {
    const harness = createMaskScene();

    harness.mask.render(false);

    assert.ok(summarizeDraws(harness).every(([target]) => target !== "isolated"));
  });

  test("hands the renderer and scene back as it found them", () => {
    const { renderer, scene, mask } = createMaskScene();
    const background = new THREE.Color("#808080");
    const outer = new THREE.RenderTarget(1, 1);
    scene.background = background;
    renderer.setRenderTarget(outer);

    mask.render();

    assert.strictEqual(scene.background, background);
    assert.strictEqual(renderer.getRenderTarget(), outer);
    assert.strictEqual(renderer.getRenderObjectFunction(), null);
    assert.strictEqual(renderer.autoClear, true);
    assert.strictEqual(renderer.clearColor.getHex(), 0x123456);
    assert.strictEqual(renderer.clearAlpha, 1);
  });

  test("clears the composite once when the entries run out", () => {
    const { renderer, mask } = createMaskScene();
    mask.render();

    mask.entries = [];
    const first = mask.render();
    const second = mask.render();

    assert.deepStrictEqual([first, second], [false, false]);
    assert.deepStrictEqual(renderer.clears, [mask.composite]);
  });
});

describe("entries", () => {
  test("returns a copy of the assigned entries", () => {
    const { mask } = createMaskScene();
    const entry = {
      target: createMesh(),
      color: "#ff0000"
    };
    mask.entries = [entry];

    const entries = mask.entries;
    entries.length = 0;

    assert.deepStrictEqual(mask.entries, [entry]);
  });

  test("replaces the previous entries and their flags", () => {
    const { mask } = createMaskScene();
    mask.entries = createEntriesOfEveryShape();
    mask.entries = [
      {
        target: createMesh(),
        color: "#0000ff"
      }
    ];

    assert.deepStrictEqual(
      {
        size: mask.size,
        hasPriority: mask.hasPriority,
        hasIsolated: mask.hasIsolated
      },
      {
        size: 1,
        hasPriority: false,
        hasIsolated: false
      }
    );
  });

  test("dispose clears the assigned entries", () => {
    const { mask } = createMaskScene();

    mask.dispose();

    assert.deepStrictEqual(mask.entries, []);
  });
});
