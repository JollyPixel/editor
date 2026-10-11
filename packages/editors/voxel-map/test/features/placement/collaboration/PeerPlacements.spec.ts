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
  BlocksetAtlases,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocumentEvents } from "../../../../src/document/MapDocument.ts";
import { CellRegion } from "../../../../src/features/placement/CellRegion.ts";
import { CopySource } from "../../../../src/features/placement/CopySource.ts";
import { MarqueePresence } from "../../../../src/features/placement/collaboration/MarqueePresence.ts";
import { PeerPlacements } from "../../../../src/features/placement/collaboration/PeerPlacements.ts";
import { Placement } from "../../../../src/features/placement/Placement.ts";
import { PlacementPreview } from "../../../../src/features/placement/PlacementPreview.ts";
import {
  LayerSource,
  TemplateSource
} from "../../../../src/features/placement/PlacementSource.ts";
import { RegionSource } from "../../../../src/features/placement/RegionSource.ts";
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
    sources: sourcesOf(new BlocksetAtlases()),
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
  const patches = from.room.presence.splice(0);
  assert.ok(patches.length > 0);
  for (const patch of patches) {
    to.room.receivePresence(kPlacer, JSON.parse(JSON.stringify(patch)));
  }
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

  test("draws a peer's lifted region from the voxels it sent once, not its own cut copy", () => {
    const [placer, observer] = connected();
    const region = CellRegion.spanning(
      { x: 1, y: 0, z: -2 },
      { x: 4, y: 3, z: 2 }
    );
    const source = RegionSource.capture(placer.world, "Draft", region);
    assert.ok(source);
    const { cells } = source.erasePatch();
    observer.world.patchVoxels("Draft", cells);
    const lifted = Placement.at(source, source.pivot);

    placer.placements.publishLocal(lifted);
    relay(placer, observer);
    placer.placements.publishLocal(lifted.movedTo({
      x: source.pivot.x,
      y: source.pivot.y,
      z: source.pivot.z + 5
    }));
    assert.deepEqual(
      placer.room.presence.map((patch) => Object.keys(patch)),
      [["placement"]]
    );
    relay(placer, observer);

    const preview = previewOf(observer);
    assert.ok(preview?.visible);
    assert.deepEqual(preview.marquee.position.toArray(), [1, 0, 5]);
    assert.deepEqual(preview.marquee.copySizeTo().toArray(), [2, 1, 1]);
  });

  test("hides a peer's region placement until its voxels arrive", () => {
    const [placer, observer] = connected();
    const source = RegionSource.capture(
      placer.world,
      "Draft",
      CellRegion.spanning({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
    );
    assert.ok(source);

    placer.placements.publishLocal(Placement.at(source, source.pivot));
    const [regionPatch, placementPatch] = placer.room.presence.splice(0);
    observer.room.receivePresence(kPlacer, JSON.parse(JSON.stringify(placementPatch)));
    assert.notEqual(previewOf(observer)?.visible, true);

    observer.room.receivePresence(kPlacer, JSON.parse(JSON.stringify(regionPatch)));
    assert.equal(previewOf(observer)?.visible, true);
  });

  test("draws a peer's pasted copy from the voxels it sent once, then swaps them for the next copy", () => {
    const [placer, observer] = connected();
    const wall = placer.world.templates.get("wall")!;
    const first = Placement.at(CopySource.fromSnapshot(wall), { x: 5, y: 0, z: 5 });

    placer.placements.publishLocal(first);
    relay(placer, observer);
    placer.placements.publishLocal(first.movedTo({ x: 5, y: 2, z: 5 }));
    assert.deepEqual(
      placer.room.presence.map((patch) => Object.keys(patch)),
      [["placement"]]
    );
    relay(placer, observer);

    const preview = previewOf(observer);
    assert.ok(preview?.visible);
    assert.deepEqual(preview.marquee.position.toArray(), [4, 2, 5]);
    assert.deepEqual(preview.marquee.copySizeTo().toArray(), [3, 1, 1]);

    const turned = CopySource.fromSnapshot(
      wall.transformed(first.turnedBy({ rotation: 1 }).transform)
    );
    placer.placements.publishLocal(Placement.at(turned, { x: 0, y: 0, z: 0 }));
    relay(placer, observer);

    assert.deepEqual(preview.marquee.copySizeTo().toArray(), [1, 1, 3]);
  });

  test("outlines a peer's marquee while it is being drawn", () => {
    const [placer, observer] = connected();

    placer.placements.publishLocal(new MarqueePresence(
      "Draft",
      CellRegion.spanning({ x: -1, y: 0, z: 2 }, { x: 3, y: 1, z: 0 })
    ));
    relay(placer, observer);

    const preview = previewOf(observer);
    assert.ok(preview?.visible);
    assert.deepEqual(preview.marquee.position.toArray(), [-1, 0, 0]);
    assert.deepEqual(preview.marquee.copySizeTo().toArray(), [5, 2, 3]);
  });
});
