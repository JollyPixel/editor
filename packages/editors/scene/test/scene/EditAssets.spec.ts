// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetType,
  type AssetReferenceData
} from "@jolly-pixel/asset";
import type {
  SceneAssetContext,
  SceneAssetSource
} from "@jolly-pixel/editor.host/scene";

// Import Internal Dependencies
import { SceneComponents } from "../../src/components/SceneComponents.ts";
import { EditAssets } from "../../src/scene/EditAssets.ts";

interface OpenedSource {
  kind: string;
  session: SceneAssetContext;
  resolved: string[];
  disposed: boolean;
}

// CONSTANTS
const kSession = {} as SceneAssetContext;
const kMap = new AssetType<string>("voxelmap");
const kModel = new AssetType<string>("voxelmodel");

function createAssets() {
  const opened: OpenedSource[] = [];
  function source(
    kind: string
  ): SceneAssetSource<string> {
    return {
      descriptor: {
        kind,
        label: kind,
        extension: `.${kind}.json`
      },
      documentKinds: [],
      open: (session) => {
        const entry: OpenedSource = {
          kind,
          session,
          resolved: [],
          disposed: false
        };
        opened.push(entry);

        return {
          resolve: (reference: AssetReferenceData) => {
            entry.resolved.push(reference.id);

            return `${kind}:${reference.id}`;
          },
          dispose: () => {
            entry.disposed = true;
          }
        };
      }
    };
  }

  return {
    assets: new EditAssets(
      new SceneComponents([
        [
          "sources",
          {
            components: [],
            assets: [source("voxelmap"), source("voxelmodel"), source("unused")]
          }
        ]
      ]),
      kSession
    ),
    opened
  };
}

describe("EditAssets", () => {
  test("opens one resolver per asset kind on first use and routes each reference to it", () => {
    const { assets, opened } = createAssets();

    const first = assets.resolve({ id: "a", kind: "voxelmap" }, kMap);
    assets.resolve({ id: "b", kind: "voxelmap" }, kMap);
    const model = assets.resolve({ id: "c", kind: "voxelmodel" }, kModel);

    assert.strictEqual(first, "voxelmap:a");
    assert.strictEqual(model, "voxelmodel:c");
    assert.deepEqual(
      opened.map(({ kind, resolved }) => [kind, resolved]),
      [["voxelmap", ["a", "b"]], ["voxelmodel", ["c"]]]
    );
    assert.strictEqual(opened[0].session, kSession);
  });

  test("refuses an asset type no source serves", () => {
    const { assets } = createAssets();

    assert.throws(
      () => assets.resolve({ id: "t", kind: "texture" }, new AssetType<string>("texture")),
      /resolves no "texture" asset/
    );
  });

  test("disposes every opened resolver on dispose", () => {
    const { assets, opened } = createAssets();
    assets.resolve({ id: "a", kind: "voxelmap" }, kMap);

    assets.dispose();

    assert.deepEqual(
      opened.map(({ kind, disposed }) => [kind, disposed]),
      [["voxelmap", true]]
    );
  });
});
