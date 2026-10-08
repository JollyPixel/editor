// Import Third-party Dependencies
import type {
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import type { Vector3Like } from "three";

export interface VoxelBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export function* positionsIn(
  box: VoxelBox
): IterableIterator<Vector3Like> {
  for (let x = box.x0; x <= box.x1; x++) {
    for (let y = box.y0; y <= box.y1; y++) {
      for (let z = box.z0; z <= box.z1; z++) {
        yield { x, y, z };
      }
    }
  }
}

export function fillBox(
  world: VoxelWorld,
  layerName: string,
  blockId: number,
  box: VoxelBox
): void {
  world.setVoxelBulk(
    layerName,
    Array.from(positionsIn(box), (position) => {
      return { position, blockId };
    })
  );
}

export function clearBox(
  world: VoxelWorld,
  layerName: string,
  box: VoxelBox
): void {
  world.removeVoxelBulk(
    layerName,
    Array.from(positionsIn(box), (position) => {
      return { position };
    })
  );
}
