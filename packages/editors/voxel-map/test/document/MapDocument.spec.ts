// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  VoxelCommand,
  VoxelDocumentEvents,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  MapDocument,
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

function setup() {
  const view = new Emitter<VoxelDocumentEvents>();
  const source = new FakeWorldSource();
  const mapDocument = new MapDocument({ commands: view, source });
  const seen: string[] = [];
  for (const event of kEvents) {
    mapDocument.on(event, () => seen.push(event));
  }

  return { view, source, mapDocument, seen };
}

function command(
  action: string
): VoxelCommand {
  return { action } as VoxelCommand;
}

describe("MapDocument", () => {
  it("routes each document command family to its own signal", () => {
    const { view, seen } = setup();

    view.emit("command", command("added"), { origin: "local" });
    view.emit("command", command("block-defined"), { origin: "remote" });
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
