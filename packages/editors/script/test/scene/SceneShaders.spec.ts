// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ScriptDocument,
  TextEdit
} from "@jolly-pixel/asset.script/client";
import type { SceneAssetContext } from "@jolly-pixel/editor.host/scene";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { SceneShaders } from "../../src/scene/SceneShaders.ts";

// CONSTANTS
const kReference = {
  kind: "shader",
  id: "water"
};

function shaderSource(
  material: string
): string {
  return `import { ${material} } from "three/webgpu";

export default () => new ${material}();
`;
}

function createShaders() {
  const document = new ScriptDocument();
  document.load(shaderSource("MeshBasicNodeMaterial"));
  const session = {
    assets: {
      open: () => {
        return {
          document,
          ready: Promise.resolve(),
          release: () => undefined
        };
      }
    },
    catalog: {
      record: () => {
        return { path: "shaders/Water.tsl.ts" };
      }
    }
  } as unknown as SceneAssetContext;
  let loaded = Promise.withResolvers<void>();
  const shaders = new SceneShaders(session, {
    loaded: () => loaded.resolve()
  });

  return {
    document,
    shaders,
    nextLoad: async() => {
      await loaded.promise;
      loaded = Promise.withResolvers<void>();
    }
  };
}

function replaceText(
  document: ScriptDocument,
  text: string
): void {
  document.edit(TextEdit.between(document.text, text)!);
}

describe("SceneShaders", () => {
  test("rebuilds the scene with each working version of an edited shader", async(context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const { document, shaders, nextLoad } = createShaders();

    assert.strictEqual(shaders.resolve(kReference), null);
    await nextLoad();
    assert.ok(
      shaders.resolve(kReference)?.createMaterial().material instanceof THREE.MeshBasicNodeMaterial
    );

    replaceText(document, "export default () => 1;\n");
    context.mock.timers.runAll();
    replaceText(document, shaderSource("MeshStandardNodeMaterial"));
    context.mock.timers.runAll();
    await nextLoad();

    assert.ok(
      shaders.resolve(kReference)?.createMaterial().material instanceof THREE.MeshStandardNodeMaterial
    );
    shaders.dispose();
  });
});
