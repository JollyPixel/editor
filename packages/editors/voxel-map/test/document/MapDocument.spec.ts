// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type ResolvedBlockDefinition,
  type VoxelCommand,
  type VoxelDocumentEvents,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  MapDocument,
  type BlockRegistryChange,
  type MapDocumentEvents,
  type WorldSource,
  type WorldSourceEvents
} from "../../src/document/index.ts";

// CONSTANTS
const kEvents: Array<keyof MapDocumentEvents> = [
  "layerUpdated",
  "blockRegistryChanged",
  "tilesetsChanged",
  "materialGroupsChanged",
  "templatesChanged",
  "reset"
];

class FakeWorldSource
  extends Emitter<WorldSourceEvents>
  implements WorldSource {
  ready = false;
  loaded: VoxelWorldJSON[] = [];
  disposed = false;

  load(
    data: VoxelWorldJSON
  ): void {
    this.loaded.push(data);
  }

  dispose(): void {
    this.disposed = true;
  }
}

class FakeCommands extends Emitter<VoxelDocumentEvents> {
  blocks: ResolvedBlockDefinition[] = [];
}

function setup() {
  const view = new FakeCommands();
  const source = new FakeWorldSource();
  const mapDocument = new MapDocument({ commands: view, source });
  const seen: string[] = [];
  for (const event of kEvents) {
    mapDocument.on(event, () => seen.push(event));
  }
  const changes: BlockRegistryChange[] = [];
  mapDocument.on("blockRegistryChanged", (change) => changes.push(change));

  return { view, source, mapDocument, seen, changes };
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
    defaultTexture: { col: 0, row: 0, tilesetId: "atlas" },
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

describe("MapDocument", () => {
  it("routes each document command family to its own signal", () => {
    const { view, seen } = setup();

    view.emit("command", command("added"), { origin: "local" });
    view.emit("command", defined(block()), { origin: "remote" });
    view.emit("command", command("tileset-added"), { origin: "local" });
    view.emit("command", command("material-group-removed"), {
      origin: "remote"
    });
    view.emit("command", command("template-defined"), { origin: "local" });
    view.emit("command", command("blend-group-defined"), { origin: "local" });

    assert.deepEqual(seen, [
      "layerUpdated",
      "blockRegistryChanged",
      "tilesetsChanged",
      "materialGroupsChanged",
      "templatesChanged"
    ]);
  });

  it("announces tilesets, blocks, material groups and templates before the reset of a source", () => {
    const { source, seen } = setup();

    source.emit("reset");

    assert.deepEqual(seen, [
      "tilesetsChanged",
      "blockRegistryChanged",
      "materialGroupsChanged",
      "templatesChanged",
      "reset"
    ]);
  });

  it("tells a block that only moved its tiles from other block changes", () => {
    const { view, changes } = setup();

    view.emit("command", defined(block()), { origin: "local" });
    view.emit("command", defined(block({
      defaultTexture: { col: 3, row: 1, size: 32, tilesetId: "atlas" }
    })), { origin: "remote" });
    view.emit("command", defined(block({
      name: "Granite"
    })), { origin: "local" });
    view.emit("command", defined(block({
      defaultTexture: { col: 3, row: 1, rotation: 1, tilesetId: "atlas" }
    })), { origin: "local" });
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
      "moved",
      "removed"
    ]);
  });

  it("knows the blocks of its command source after a reset", () => {
    const { view, source, changes } = setup();
    view.blocks = [block()];

    source.emit("reset");
    view.emit("command", defined(block({
      defaultTexture: { col: 2, row: 0, tilesetId: "atlas" }
    })), { origin: "remote" });

    assert.deepEqual(changes, ["reset", "retiled"]);
  });

  it("mirrors the readiness of its source", () => {
    const { source, mapDocument } = setup();

    assert.equal(mapDocument.ready, false);
    source.ready = true;
    assert.equal(mapDocument.ready, true);
  });

  it("delegates world loading to its source", () => {
    const { source, mapDocument } = setup();
    const data = { layers: [] } as unknown as VoxelWorldJSON;

    mapDocument.load(data);

    assert.deepEqual(source.loaded, [data]);
  });

  it("stops listening and releases its source once disposed", () => {
    const { view, source, mapDocument, seen } = setup();

    mapDocument.dispose();
    view.emit("command", command("added"), { origin: "local" });
    source.emit("reset");

    assert.deepEqual(seen, []);
    assert.equal(source.disposed, true);
  });
});
