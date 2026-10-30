// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { VoxelMapAnchorKey } from "../../../src/plugins/engine/VoxelMapAnchors.ts";
import { VoxelMapDefinition } from "../../../src/plugins/engine/VoxelMapDefinition.ts";
import type { VoxelMapSource } from "../../../src/plugins/engine/VoxelMapSource.ts";
import { VoxelDocument } from "../../../src/document/VoxelDocument.ts";
import type { VoxelView } from "../../../src/view/VoxelView.ts";
import { makeActor } from "../../helpers/engineActor.ts";

// CONSTANTS
const kMapReference: AssetReferenceData = {
  id: "map-1",
  kind: "voxelmap"
};

interface MapSourceProbe {
  source: VoxelMapSource;
  attached: VoxelView[];
  detached: VoxelView[];
}

function makeMapSource(): MapSourceProbe {
  const probe: MapSourceProbe = {
    source: {
      document: new VoxelDocument({ layers: ["Ground", "Roof"] }),
      attach: (view) => {
        probe.attached.push(view);

        return () => void probe.detached.push(view);
      }
    },
    attached: [],
    detached: []
  };

  return probe;
}

function createMap(
  map: VoxelMapSource | null,
  data: Systems.JSONObject = {}
) {
  const definition = new VoxelMapDefinition();
  const resolved: AssetReferenceData[] = [];
  const renderer = definition.create(
    makeActor(),
    definition.parse(data),
    {
      mode: "edit",
      assets: new Systems.ComponentAssets(
        definition.assets,
        { map: map === null ? null : kMapReference },
        {
          resolve: <TValue>(reference: AssetReferenceData): TValue => {
            resolved.push(reference);

            return map as TValue;
          }
        }
      )
    }
  );

  return { definition, renderer, resolved };
}

describe("VoxelMapDefinition", () => {
  it("parses missing or invalid fields to their defaults", () => {
    const definition = new VoxelMapDefinition();

    assert.deepStrictEqual(
      definition.parse({
        castShadow: "yes",
        layers: ["Ground"]
      }),
      {
        castShadow: false,
        receiveShadow: false,
        layers: {}
      }
    );
    assert.deepStrictEqual(
      definition.parse({ layers: { Ground: false, Roof: 1 } }).layers,
      { Ground: false }
    );
  });

  it("creates nothing while the map slot is empty", () => {
    const { renderer, resolved } = createMap(null);

    assert.strictEqual(renderer, null);
    assert.deepStrictEqual(resolved, []);
  });

  it("draws the map document and keeps its view attached until destroyed", () => {
    const probe = makeMapSource();
    const { renderer, resolved } = createMap(probe.source, {
      castShadow: true,
      layers: { Roof: false }
    });
    assert.ok(renderer);

    assert.deepStrictEqual(resolved, [kMapReference]);
    assert.strictEqual(renderer.document, probe.source.document);
    assert.deepStrictEqual(probe.attached, [renderer.view]);
    assert.strictEqual(renderer.view.lighting.castShadow, true);
    assert.strictEqual(renderer.view.lighting.receiveShadow, false);
    assert.deepStrictEqual(
      [...renderer.view.layerVisibility.overrides],
      [["Roof", false]]
    );

    renderer.destroy();

    assert.deepStrictEqual(probe.detached, [renderer.view]);
  });

  it("apply replaces the layer overrides and shadow flags", () => {
    const { definition, renderer } = createMap(makeMapSource().source, {
      castShadow: true,
      receiveShadow: true,
      layers: { Ground: false, Roof: false }
    });
    assert.ok(renderer);

    definition.apply(renderer, definition.parse({
      layers: { Roof: true }
    }));

    assert.strictEqual(renderer.view.lighting.castShadow, false);
    assert.strictEqual(renderer.view.lighting.receiveShadow, false);
    assert.deepStrictEqual(
      [...renderer.view.layerVisibility.overrides],
      [["Roof", true]]
    );
  });

  it("anchors only the layers and objects marked as anchors", () => {
    const probe = makeMapSource();
    const { world } = probe.source.document;
    world.updateLayer("Ground", { anchor: true });
    world.setLayerPosition("Ground", { x: 4, y: 2, z: 0 });
    world.objectLayers.add("Points");
    world.objectLayers.addObject("Points", {
      id: "spawn",
      name: "Spawn",
      x: 1,
      y: 3,
      z: 5,
      width: 2,
      height: 4,
      rotation: 90,
      visible: true,
      anchor: true
    });
    world.objectLayers.addObject("Points", {
      id: "rock",
      name: "Rock",
      x: 0,
      y: 0,
      z: 0,
      visible: true
    });
    const { definition, renderer } = createMap(probe.source);
    assert.ok(renderer);

    assert.deepStrictEqual([...definition.anchors(renderer).list()], [
      {
        key: `layer:${world.getLayer("Ground")!.id}`,
        label: "Ground",
        kind: "layer",
        pose: {
          position: { x: 4, y: 2, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      },
      {
        key: "object:spawn",
        label: "Spawn",
        kind: "object",
        pose: {
          position: { x: 2, y: 3, z: 7 },
          rotation: { x: 0, y: 90, z: 0 }
        }
      }
    ]);
  });

  it("parses an anchor key back to its layer or object id and refuses any other key", () => {
    assert.deepStrictEqual(
      VoxelMapAnchorKey.parse("layer:ground-id"),
      VoxelMapAnchorKey.layer("ground-id")
    );
    assert.deepStrictEqual(
      VoxelMapAnchorKey.parse("object:a:b"),
      VoxelMapAnchorKey.object("a:b")
    );
    assert.strictEqual(VoxelMapAnchorKey.object("spawn").toString(), "object:spawn");
    for (const key of ["spawn", "layer:", "voxel:1", ":spawn"]) {
      assert.strictEqual(VoxelMapAnchorKey.parse(key), null, key);
    }
  });

  it("notifies anchor listeners of layer and object changes, not voxel edits", () => {
    const probe = makeMapSource();
    const { world } = probe.source.document;
    world.updateLayer("Ground", { anchor: true });
    const { definition, renderer } = createMap(probe.source);
    assert.ok(renderer);
    const anchors = definition.anchors(renderer);
    let notified = 0;
    const unsubscribe = anchors.subscribe(() => notified++);

    world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });
    assert.strictEqual(notified, 0);

    world.setLayerPosition("Ground", { x: 0, y: 6, z: 0 });
    assert.strictEqual(notified, 1);
    assert.deepStrictEqual(
      [...anchors.list()].map(({ pose }) => pose.position),
      [{ x: 0, y: 6, z: 0 }]
    );

    unsubscribe();
    world.updateLayer("Ground", { anchor: false });
    assert.strictEqual(notified, 1);
    assert.deepStrictEqual([...anchors.list()], []);
  });
});
