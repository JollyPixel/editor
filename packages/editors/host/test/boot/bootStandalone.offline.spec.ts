// Import Node.js Dependencies
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BINARY_KIND,
  TEXTURE_KIND,
  textureAssetKind,
  type AnyAssetKindHandler
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { bootStandalone } from "#src/boot/bootStandalone.ts";
import type {
  EditorContext,
  EditorHandle
} from "#src/boot/EditorDefinition.ts";
import type { OfflineMode } from "#src/connection/OfflineMode.ts";
import { editorHandle } from "../helpers/editorHandle.ts";

interface OfflineBoot {
  target: string;
  offline: OfflineMode | null;
}

async function bootOffline(
  accepts: string,
  handlers: AnyAssetKindHandler[],
  seedPath: string
): Promise<OfflineBoot> {
  const booted: OfflineBoot[] = [];
  const editor = await bootStandalone({
    accepts,
    identity: { title: "never prompted" },
    kinds: [],
    mount: (context: EditorContext): Promise<EditorHandle> => {
      booted.push({
        target: context.launch.target.value,
        offline: context.session.offline
      });

      return Promise.resolve(editorHandle(context.session));
    }
  }, {
    forceOffline: true,
    offline: () => {
      return {
        handlers,
        seed: {
          [seedPath]: {
            id: `${accepts}-seed`,
            kind: accepts,
            content: () => new Uint8Array([1])
          }
        }
      };
    }
  });
  editor.dispose();

  return booted[0];
}

test("editors of different kinds open side by side on their own seeded offline data", async(context) => {
  const binary = await bootOffline(BINARY_KIND, [], "notes/readme.bin");
  context.after(() => binary.offline?.reset());
  const texture = await bootOffline(
    TEXTURE_KIND,
    [textureAssetKind()],
    "textures/atlas.png"
  );
  context.after(() => texture.offline?.reset());

  assert.equal(binary.target, "binary-seed");
  assert.equal(texture.target, "texture-seed");
});
