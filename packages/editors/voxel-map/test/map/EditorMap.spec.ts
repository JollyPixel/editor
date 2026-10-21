// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  VoxelDocument,
  resolveBlockDefinition,
  type BlockDefinition,
  type BlockRedefinition,
  type ResolvedBlockDefinition,
  type VoxelCommand,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  EditorMap,
  type BlockRegistryChange,
  type EditorMapEvents,
  type SyncedMap
} from "../../src/map/EditorMap.ts";
import { MAP_CAPABILITIES } from "../../src/access/MapAccess.ts";
import { mapAccess } from "../helpers/mapAccess.ts";

// CONSTANTS
const kEvents: Array<keyof EditorMapEvents> = [
  "layerUpdated",
  "blockRegistryChanged",
  "blocksetsChanged",
  "materialGroupsChanged",
  "templatesChanged",
  "reset"
];

const kDefaultLayerName = "Ground";

class FakeMap implements SyncedMap {
  readonly voxels = new VoxelDocument();
  loaded = false;
  replaced: VoxelWorldJSON[] = [];

  replaceWorld(
    data: VoxelWorldJSON
  ): void {
    this.replaced.push(data);
  }
}

function setup(
  map = new FakeMap(),
  access = mapAccess()
) {
  const view = map.voxels;
  const editorMap = new EditorMap({
    map,
    defaultLayerName: kDefaultLayerName,
    access
  });
  const seen: string[] = [];
  for (const event of kEvents) {
    editorMap.on(event, () => seen.push(event));
  }
  const changes: BlockRegistryChange[] = [];
  editorMap.on("blockRegistryChanged", (change) => changes.push(change));

  return { map, view, editorMap, seen, changes };
}

function command(
  action: string
): VoxelCommand {
  return { action } as VoxelCommand;
}

function block(
  overrides: Partial<BlockDefinition> = {}
): ResolvedBlockDefinition {
  return resolveBlockDefinition({
    id: 1,
    name: "Stone",
    shapeId: "cube",
    defaultTexture: { col: 0, row: 0, blocksetId: "atlas" },
    ...overrides
  });
}

function defined(
  definition: ResolvedBlockDefinition
): VoxelCommand {
  return {
    action: "block-defined",
    block: definition
  };
}

describe("EditorMap", () => {
  it("routes each document command family to its own signal", () => {
    const { view, seen } = setup();

    view.emit("command", command("added"), { origin: "local" });
    view.emit("command", defined(block()), { origin: "remote" });
    view.emit("command", command("blockset-added"), { origin: "local" });
    view.emit("command", command("material-group-removed"), {
      origin: "remote"
    });
    view.emit("command", command("template-defined"), { origin: "local" });
    view.emit("command", command("blend-group-defined"), { origin: "local" });

    assert.deepEqual(seen, [
      "layerUpdated",
      "blockRegistryChanged",
      "blocksetsChanged",
      "materialGroupsChanged",
      "templatesChanged"
    ]);
  });

  it("announces the default layer and every registry before the reset of a loaded map", () => {
    const { view, seen } = setup();

    view.emit("loaded");

    assert.deepEqual(seen, [
      "layerUpdated",
      "blocksetsChanged",
      "blockRegistryChanged",
      "materialGroupsChanged",
      "templatesChanged",
      "reset"
    ]);
  });

  it("tells a block that only moved its tiles from other block changes", () => {
    const { view, changes } = setup();
    const redefinitions: BlockRedefinition[] = [
      "added",
      "tiles",
      "metadata",
      "mesh",
      "occlusion"
    ];

    for (const redefinition of redefinitions) {
      view.emit("command", defined(block()), {
        origin: "local",
        redefinition
      });
    }
    view.emit("command", {
      action: "block-moved",
      blockId: 1,
      toIndex: 0
    }, { origin: "local" });
    view.emit("command", {
      action: "block-removed",
      blockId: 1
    }, { origin: "local" });

    assert.deepEqual(changes, [
      "added",
      "retiled",
      "redefined",
      "redefined",
      "redefined",
      "moved",
      "removed"
    ]);
  });

  it("follows the redefinition its map reports for a moved tile", () => {
    const { view, changes } = setup();
    view.defineBlock(block());

    view.defineBlock(block({
      defaultTexture: { col: 3, row: 1, size: 32, blocksetId: "atlas" }
    }));

    assert.deepEqual(changes, ["added", "retiled"]);
  });

  it("reads the world, blocks and material groups of its document", () => {
    const { view, editorMap } = setup();

    assert.equal(editorMap.world, view.world);
    assert.equal(editorMap.blocks, view.blocks);
    assert.equal(editorMap.materialGroups, view.materialGroups);
  });

  it("mirrors whether its map has loaded", () => {
    const { map, editorMap } = setup();

    assert.equal(editorMap.ready, false);
    map.loaded = true;
    assert.equal(editorMap.ready, true);
  });

  it("replaces the world of its map when loading", () => {
    const { map, editorMap } = setup();
    const data = { layers: [] } as unknown as VoxelWorldJSON;

    editorMap.load(data);

    assert.deepEqual(map.replaced, [data]);
  });

  it("adds the default layer to a map that loads without layers", () => {
    const { view, editorMap } = setup();
    const layersOnReset: string[] = [];
    editorMap.on("reset", () => {
      layersOnReset.push(...view.world.getLayers().map((layer) => layer.name));
    });

    view.emit("loaded");

    assert.deepEqual(layersOnReset, [kDefaultLayerName]);
  });

  it("adds the default layer to a map that had already loaded", () => {
    const map = new FakeMap();
    map.loaded = true;

    const { view } = setup(map);

    assert.deepEqual(
      view.world.getLayers().map((layer) => layer.name),
      [kDefaultLayerName]
    );
  });

  it("leaves an empty map without layers for a role that cannot add one", () => {
    const { view } = setup(new FakeMap(), mapAccess(MAP_CAPABILITIES.none));

    view.emit("loaded");

    assert.equal(view.world.getLayers().length, 0);
  });

  it("keeps the layers of a map that loads with layers", () => {
    const { view } = setup();
    view.world.addLayer("Sky");

    view.emit("loaded");

    assert.deepEqual(
      view.world.getLayers().map((layer) => layer.name),
      ["Sky"]
    );
  });

  it("stops listening to its map once disposed", () => {
    const { view, editorMap, seen } = setup();

    editorMap.dispose();
    view.emit("command", command("added"), { origin: "local" });
    view.emit("loaded");

    assert.deepEqual(seen, []);
    assert.equal(view.world.getLayers().length, 0);
  });
});
