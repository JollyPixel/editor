// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelTemplate,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { CellRegion } from "../../../../src/features/placement/CellRegion.ts";
import { Placement } from "../../../../src/features/placement/Placement.ts";
import { PlacementPresence } from "../../../../src/features/placement/collaboration/PlacementPresence.ts";
import {
  LayerSource,
  TemplateSource
} from "../../../../src/features/placement/PlacementSource.ts";
import { RegionSource } from "../../../../src/features/placement/RegionSource.ts";

function overTheWire(
  presence: PlacementPresence
): PlacementPresence | null {
  return PlacementPresence.parse(JSON.parse(JSON.stringify(presence)));
}

describe("PlacementPresence", () => {
  test("carries a template placement over the wire", () => {
    const placement = Placement
      .at(new TemplateSource("wall"), { x: 4, y: 0, z: -1 })
      .turnedBy({ rotation: 1, flipX: true });

    const received = overTheWire(PlacementPresence.of(placement));

    assert.deepEqual(received?.source, {
      kind: "template",
      templateId: "wall"
    });
    assert.deepEqual(received?.position, { x: 4, y: 0, z: -1 });
    assert.equal(received?.transform, placement.transform);
  });

  test("carries a layer transform by layer name only", () => {
    const placement = Placement.at(
      new LayerSource(
        "Draft",
        new VoxelTemplate({
          id: "layer:Draft",
          name: "Draft",
          positions: [],
          voxels: []
        }),
        { x: 1, y: 2, z: 3 }
      ),
      { x: 1, y: 2, z: 3 }
    );

    const json = JSON.parse(JSON.stringify(PlacementPresence.of(placement)));

    assert.deepEqual(json.source, {
      kind: "layer",
      layerName: "Draft"
    });
    assert.deepEqual(overTheWire(PlacementPresence.of(placement))?.source, json.source);
  });

  test("rejects malformed payloads", () => {
    const valid = {
      source: {
        kind: "template",
        templateId: "wall"
      },
      position: { x: 0, y: 0, z: 0 },
      transform: 0
    };
    const payloads: unknown[] = [
      null,
      "wall",
      { ...valid, source: { kind: "brush", templateId: "wall" } },
      { ...valid, source: { kind: "template", templateId: "" } },
      { ...valid, source: { kind: "layer", templateId: "wall" } },
      { ...valid, position: { x: 0.5, y: 0, z: 0 } },
      { ...valid, position: { x: 0, y: 0 } },
      { ...valid, transform: 32 },
      { ...valid, transform: -1 },
      { ...valid, transform: "0" },
      { ...valid, source: { kind: "region", layerName: "Draft" } },
      { ...valid, source: { kind: "copy", copyId: "" } },
      {
        ...valid,
        source: {
          kind: "region",
          layerName: "Draft",
          region: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 0, z: 1 } }
        }
      }
    ];

    assert.notEqual(PlacementPresence.parse(valid), null);
    for (const payload of payloads) {
      assert.equal(PlacementPresence.parse(payload), null, JSON.stringify(payload));
    }
  });

  test("compares sources by reference id rather than instance", () => {
    const at = { x: 0, y: 0, z: 0 };
    const first = PlacementPresence.of(Placement.at(new TemplateSource("wall"), at));
    const second = PlacementPresence.of(Placement.at(new TemplateSource("wall"), at));
    const turned = PlacementPresence.of(
      Placement.at(new TemplateSource("wall"), at).turnedBy({ rotation: 1 })
    );
    const other = PlacementPresence.of(Placement.at(new TemplateSource("door"), at));

    assert.ok(first.equals(second));
    assert.ok(!first.equals(turned));
    assert.ok(!first.equals(other));
  });

  test("tells regions of the same layer apart", () => {
    const world = new VoxelWorld();
    world.addLayer("Draft");
    world.setVoxelBulk("Draft", [0, 1, 2].map((x) => {
      return {
        position: { x, y: 0, z: 0 },
        blockId: 1
      };
    }));
    function presenceOf(
      to: number
    ): PlacementPresence {
      const region = CellRegion.spanning({ x: 0, y: 0, z: 0 }, { x: to, y: 0, z: 0 });
      const source = RegionSource.capture(world, "Draft", region)!;

      return overTheWire(PlacementPresence.of(Placement.at(source, { x: 0, y: 0, z: 0 })))!;
    }

    assert.ok(presenceOf(1).equals(presenceOf(1)));
    assert.ok(!presenceOf(1).equals(presenceOf(2)));
  });
});
