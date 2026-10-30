// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  DEFAULT_POI_PROPERTIES,
  terrainAssetKind,
  terrainSnapshot
} from "#src/index.ts";
import { historySetup } from "../helpers/history.ts";
import { edgePeerSetup } from "../helpers/peers.ts";
import { networkCommand } from "../helpers/terrain.ts";

// CONSTANTS
const kMountain = { name: "Mountain", chunks: [{ x: 0, z: 0 }, { x: 1, z: 0 }] };

describe("terrain points of interest", () => {
  test("a point of interest reaches the room, is saved with the terrain, and undoes by field", async() => {
    const { history, document, server, route } = historySetup();
    const points = server.state.pointsOfInterest;
    const id = document.addPointOfInterest(kMountain)!;
    history.record("terrain", null, () => document.updatePointOfInterest(id, { lodBias: 4, chunks: [] }));
    route();

    const added = { ...DEFAULT_POI_PROPERTIES, ...kMountain, id };
    assert.deepEqual(points.pointOfInterest(id), { ...added, lodBias: 4, chunks: [] });
    const handler = terrainAssetKind();
    const loaded = handler.create("copy");
    handler.load(loaded, await handler.serialize(server.state));
    assert.deepEqual(loaded.pointsOfInterest.pointsOfInterest(), points.pointsOfInterest());

    assert.equal(history.undo("terrain"), true);
    route();
    assert.deepEqual(points.pointOfInterest(id), added);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test("peers editing different fields both land, and a removal wins over a concurrent edit", () => {
    const { server, document, route } = edgePeerSetup();
    const id = document.addPointOfInterest(kMountain)!;
    route();

    document.updatePointOfInterest(id, { name: "Peak" });
    const peerEdit = { action: "poi-updated", id, changes: { priority: 5 } } as const;
    server.receive("A", networkCommand(peerEdit, { clientId: "A" }));
    route();
    const point = document.pointsOfInterest.pointOfInterest(id);
    assert.deepEqual([point?.name, point?.priority], ["Peak", 5]);

    document.updatePointOfInterest(id, { minLevel: 1 });
    server.receive("A", networkCommand({ action: "poi-removed", id }, { clientId: "A" }));
    route();
    assert.equal(document.pointsOfInterest.size, 0);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test("a point of interest naming a chunk twice is refused", () => {
    const { document } = edgePeerSetup();

    assert.equal(document.addPointOfInterest({ chunks: [{ x: 0, z: 0 }, { x: 0, z: 0 }] }), null);
    assert.equal(document.pointsOfInterest.size, 0);
  });
});
