// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  SceneDocument,
  type AddActorOptions
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import { AnchorMarkers } from "../../src/features/viewport/AnchorMarkers.ts";
import { SelectionStore } from "../../src/state/SelectionStore.ts";
import { createProbeBinding } from "../helpers/probeComponents.ts";

// CONSTANTS
const kSpawn = { component: "map", key: "object:spawn" };
const kDown = new THREE.Vector3(0, -1, 0);

function createMarkers(
  map: Partial<AddActorOptions> = {}
) {
  const document = new SceneDocument();
  const mapId = document.addActor({
    name: "Map",
    components: [{ id: "map", type: "Anchored", data: {}, assets: {} }],
    ...map
  })!;
  const { world, binding } = createProbeBinding(document);
  const selection = new SelectionStore(document, binding);
  const markers = world
    .createActor("anchor-markers")
    .addComponentAndGet(AnchorMarkers, {
      live: binding,
      selection
    });

  function pickAbove(
    x: number,
    z: number
  ) {
    markers.update();

    return markers.pick(new THREE.Ray(new THREE.Vector3(x, 10, z), kDown));
  }

  return {
    document,
    mapId,
    selection,
    pickAbove
  };
}

describe("AnchorMarkers", () => {
  test("marks the selected actor's anchors at the owner's pose until it is deselected", () => {
    const { mapId, selection, pickAbove } = createMarkers({
      transform: { position: { x: 1, y: 2, z: 0 } }
    });

    assert.strictEqual(pickAbove(6, 0), null);

    selection.select([mapId]);
    assert.deepEqual(pickAbove(6, 0), { ownerId: mapId, anchor: kSpawn });
    assert.strictEqual(pickAbove(5, 0), null);

    selection.select([]);
    assert.strictEqual(pickAbove(6, 0), null);
  });

  test("marks the anchor a selected child hangs from while its owner stays unselected", () => {
    const { document, mapId, selection, pickAbove } = createMarkers();
    const coinId = document.addActor({ name: "Coin", parentId: mapId, anchor: kSpawn })!;

    selection.select([coinId]);

    assert.deepEqual(pickAbove(5, 0), { ownerId: mapId, anchor: kSpawn });
  });

  test("leaves the anchors of a hidden owner unpickable", () => {
    const { mapId, selection, pickAbove } = createMarkers({ visible: false });

    selection.select([mapId]);

    assert.strictEqual(pickAbove(5, 0), null);
  });
});
