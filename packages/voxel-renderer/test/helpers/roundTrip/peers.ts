// Import Internal Dependencies
import { VoxelWorld } from "../../../src/document/world/index.ts";
import type { VoxelWorldContentCommand } from "../../../src/document/commands/index.ts";
import {
  deserializeVoxelWorld,
  serializeVoxelTemplate,
  serializeVoxelWorld
} from "../../../src/document/serialization/index.ts";
import { makeVoxelEntry } from "../voxelEntry.ts";
import { makeObject, recordCommands } from "../fakes.ts";
import {
  withoutId,
  writeVoxel
} from "../world.ts";

export interface RoundTripCase {
  name: string;
  seed?: (world: VoxelWorld) => void;
  act: (world: VoxelWorld) => void;
  actions: VoxelWorldContentCommand["action"][];
  check?: (remote: VoxelWorld) => void;
}

export interface Peers {
  local: VoxelWorld;
  remote: VoxelWorld;
  commands: VoxelWorldContentCommand[];
}

export function makePeers(
  seed: (world: VoxelWorld) => void = () => void 0
): Peers {
  const local = new VoxelWorld(4);
  const remote = new VoxelWorld(4);
  seed(local);
  deserializeVoxelWorld(serializeVoxelWorld(local), remote);

  return { local, remote, commands: recordCommands(local) };
}

export function readState(
  world: VoxelWorld
): unknown {
  return {
    layers: world.getLayers().map(withoutId),
    objectLayers: world.objectLayers.toArray().map(({ id, ...rest }) => structuredClone(rest)),
    templates: world.templates.toArray().map((template) => serializeVoxelTemplate(template))
  };
}

export function ground(
  world: VoxelWorld
): void {
  world.addLayer("Ground");
  writeVoxel(world, "Ground", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
  writeVoxel(world, "Ground", { x: 1, y: 0, z: 0 }, makeVoxelEntry(2));
}

export function mergedGround(
  world: VoxelWorld
): void {
  ground(world);
  world.setVoxel("Ground", {
    position: { x: 0, y: 0, z: 0 },
    blockId: 3,
    flipY: true,
    merge: true
  });
}

export function stack(
  world: VoxelWorld
): void {
  for (const name of ["A", "B", "C"]) {
    world.addLayer(name);
  }
}

export function spawns(
  world: VoxelWorld
): void {
  world.objectLayers.add("From");
  world.objectLayers.add("To");
  world.objectLayers.addObject("From", makeObject({ id: "obj1" }));
  world.objectLayers.addObject("From", makeObject({ id: "obj2" }));
}

export function steps(
  world: VoxelWorld
): void {
  ground(world);
  world.templates.createFromLayer("Ground", { name: "Steps", id: "steps" });
}
