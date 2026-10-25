// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
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
});
