// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import type { Box3 } from "three";
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapLayers } from "../../../src/features/layers/MapLayers.ts";
import { revealAnchor } from "../../../src/features/layers/revealAnchor.ts";
import {
  EditContext,
  ObjectRef,
  SelectionStore,
  VoxelLayerRef
} from "../../../src/state/index.ts";
import { createEditorMap } from "../../helpers/editorMap.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";

function createReveal() {
  const world = new VoxelWorld(4);
  world.addLayer("Ground");
  world.addLayer("Deco");
  world.setVoxel("Deco", { position: { x: 2, y: 0, z: 0 }, blockId: 1 });
  world.objectLayers.add("Triggers");
  world.objectLayers.add("Spawns");
  world.objectLayers.addObject("Spawns", {
    id: "spawn",
    name: "Spawn",
    visible: true,
    x: 3,
    y: 1,
    z: 4
  });
  const selection = new SelectionStore();
  const layers = new MapLayers({
    world,
    editContext: new EditContext(),
    selection,
    editorMap: createEditorMap(world),
    access: mapAccess()
  });
  const framed: Box3[] = [];

  return {
    world,
    selection,
    layers,
    framed,
    reveal: (key: string) => revealAnchor({
      world,
      selection,
      layers,
      frame: (bounds) => framed.push(bounds)
    }, key)
  };
}

describe("revealAnchor", () => {
  test("selects and frames the layer or object an anchor key names", () => {
    const { world, selection, layers, framed, reveal } = createReveal();

    reveal(`layer:${world.getLayer("Deco")!.id}`);
    const deco = new VoxelLayerRef("Deco");
    assert.ok(deco.equals(selection.current));

    reveal("object:spawn");
    const spawn = new ObjectRef("Spawns", "spawn");
    assert.ok(spawn.equals(selection.current));

    assert.deepEqual(framed, [layers.bounds(deco), layers.bounds(spawn)]);
  });

  test("leaves the selection and the camera alone for a key the map does not have", () => {
    const { selection, framed, reveal } = createReveal();
    selection.selectVoxelLayer("Ground");

    for (const key of ["object:gone", "layer:gone", "voxel:spawn"]) {
      reveal(key);
    }

    assert.ok(new VoxelLayerRef("Ground").equals(selection.current));
    assert.deepEqual(framed, []);
  });
});
