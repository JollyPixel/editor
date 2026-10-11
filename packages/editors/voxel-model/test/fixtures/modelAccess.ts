// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { VoxelModelCommandAction } from "@jolly-pixel/asset.voxel-model/client";
import {
  Grants,
  type RoomGrantsEventMap
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  MODEL_CAPABILITIES,
  type ModelAccess,
  type ModelCapability
} from "../../src/access/ModelAccess.ts";

export class TestModelAccess extends Emitter<
  RoomGrantsEventMap<VoxelModelCommandAction, ModelCapability>
> {
  current: ModelAccess;

  constructor(
    current: ModelAccess = MODEL_CAPABILITIES.full
  ) {
    super();
    this.current = current;
  }

  grant(
    ...capabilities: ModelCapability[]
  ): void {
    this.current = new Grants(capabilities);
    this.emit("change", this.current);
  }
}

export function modelAccess(
  current?: ModelAccess
): TestModelAccess {
  return new TestModelAccess(current);
}
