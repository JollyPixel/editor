// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { Actor } from "@jolly-pixel/engine";
import {
  BlockRegistry,
  TilesetAtlases,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocumentEvents } from "../../../../src/document/MapDocument.ts";
import { PeerPlacements } from "../../../../src/features/placement/collaboration/PeerPlacements.ts";
import { Placement } from "../../../../src/features/placement/Placement.ts";
import { PlacementPreview } from "../../../../src/features/placement/PlacementPreview.ts";
import {
  LayerSource,
  TemplateSource
} from "../../../../src/features/placement/PlacementSource.ts";
import { sceneActor } from "../../../helpers/actors.ts";
import { sourcesOf } from "../../../helpers/blockSources.ts";
import { FakeRoom } from "../../../helpers/rooms.ts";

// CONSTANTS
const kPlacer = "alice";

interface Replica {
  world: VoxelWorld;
  room: FakeRoom;
  actor: Actor;
  placements: PeerPlacements;
}

function replica(): Replica {
  const world = new VoxelWorld();
  world.addLayer("Draft");
  world.setVoxelBulk("Draft", [0, 1, 2].map((x) => {
    return {
      position: { x, y: 0, z: 0 },
      blockId: 1
    };
  }));
  world.templates.createFromLayer("Draft", {
    id: "wall",
    name: "Wall"
  });

  const room = new FakeRoom();
  const actor = sceneActor();
  const placements = new PeerPlacements(actor, {
    room,
    world,
    blockRegistry: new BlockRegistry([
      {
        id: 1,
        name: "Stone",
        shapeId: "cube"
      }
    ]),
    sources: sourcesOf(new TilesetAtlases()),
    mapDocument: new Emitter<MapDocumentEvents>()
  });

  return {
    world,
    room,
    actor,
    placements
  };
}

function connected(): [Replica, Replica] {
  const placer = replica();
  const observer = replica();
  observer.room.joinPeer(kPlacer);

  return [placer, observer];
}

function relay(
  from: Replica,
  to: Replica
): void {
  const patch = from.room.presence.at(-1);
  assert.ok(patch);
  to.room.receivePresence(kPlacer, JSON.parse(JSON.stringify(patch)));
}

function previewOf(
  replica: Replica
): PlacementPreview | undefined {
  const object = replica.actor.object3D.getObjectByName(
    `peer-placement:${kPlacer}`
  );

  return object instanceof PlacementPreview ? object : undefined;
}

describe("PeerPlacements", () => {
  test("draws a peer's template placement where the peer sees it", () => {
    const [placer, observer] = connected();
    const placement = Placement
      .at(new TemplateSource("wall"), { x: 4, y: 0, z: -1 })
      .turnedBy({ rotation: 1 });

    placer.placements.publishLocal(placement);
    relay(placer, observer);

    const preview = previewOf(observer);
    const { min } = placement.boundsIn(placer.world.templates.get("wall")!);
    assert.ok(preview?.visible);
    assert.deepEqual(preview.marquee.position.toArray(), [min.x, min.y, min.z]);
    assert.deepEqual(preview.marquee.copySizeTo().toArray(), [1, 1, 3]);
  });

  test("hides the preview when the peer ends and drops it when the peer leaves", () => {
    const [placer, observer] = connected();
    placer.placements.publishLocal(
      Placement.at(new TemplateSource("wall"), { x: 0, y: 0, z: 0 })
    );
    relay(placer, observer);

    placer.placements.publishLocal(null);
    relay(placer, observer);
    assert.equal(previewOf(observer)?.visible, false);

    observer.room.leavePeer(kPlacer);
    assert.equal(previewOf(observer), undefined);
  });

  test("shows nothing for a template the observer does not have", () => {
    const [placer, observer] = connected();
    placer.world.templates.createFromLayer("Draft", {
      id: "tower",
      name: "Tower"
    });

    placer.placements.publishLocal(
      Placement.at(new TemplateSource("tower"), { x: 0, y: 0, z: 0 })
    );
    relay(placer, observer);

    assert.notEqual(previewOf(observer)?.visible, true);
  });

  test("draws a peer's layer transform from the observer's copy of the layer", () => {
    const [placer, observer] = connected();
    const source = LayerSource.capture(placer.world, "Draft");
    assert.ok(source);

    placer.placements.publishLocal(
      Placement.at(source, source.pivot).movedTo({
        x: source.pivot.x,
        y: source.pivot.y,
        z: source.pivot.z + 5
      })
    );
    relay(placer, observer);

    const preview = previewOf(observer);
    assert.ok(preview?.visible);
    assert.deepEqual(preview.marquee.position.toArray(), [0, 0, 5]);
    assert.deepEqual(preview.marquee.copySizeTo().toArray(), [3, 1, 1]);
  });
});
