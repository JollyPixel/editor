// Import Third-party Dependencies
import {
  VoxelTransform,
  type VoxelCoord,
  type VoxelTransformOptions
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

export interface TemplatePlacement {
  readonly templateId: string;
  readonly position: Readonly<VoxelCoord>;
  readonly transform: VoxelTransform;
}

export type TemplateStoreEvents = {
  selectionChange: (
    templateId: string | null
  ) => void;
  placementChange: (
    placement: TemplatePlacement | null
  ) => void;
};

export class TemplateStore extends Emitter<TemplateStoreEvents> {
  #selected: string | null = null;
  #placement: TemplatePlacement | null = null;

  get selected(): string | null {
    return this.#selected;
  }

  set selected(
    templateId: string | null
  ) {
    if (this.#selected === templateId) {
      return;
    }

    this.#selected = templateId;
    this.emit("selectionChange", templateId);
  }

  get placement(): TemplatePlacement | null {
    return this.#placement;
  }

  get placing(): boolean {
    return this.#placement !== null;
  }

  beginPlacement(
    templateId: string,
    position: VoxelCoord
  ): void {
    this.selected = templateId;
    this.#assignPlacement({
      templateId,
      position: cellOf(position),
      transform: VoxelTransform.Identity
    });
  }

  movePlacement(
    position: VoxelCoord
  ): void {
    const placement = this.#placement;
    if (placement === null) {
      return;
    }

    const cell = cellOf(position);
    if (
      cell.x === placement.position.x &&
      cell.y === placement.position.y &&
      cell.z === placement.position.z
    ) {
      return;
    }

    this.#assignPlacement({
      ...placement,
      position: cell
    });
  }

  transformPlacement(
    transform: VoxelTransformOptions
  ): void {
    const placement = this.#placement;
    const outer = VoxelTransform.fromPacked(VoxelTransform.pack(transform));
    if (placement === null || outer.equals(VoxelTransform.Identity)) {
      return;
    }

    this.#assignPlacement({
      ...placement,
      transform: placement.transform.followedBy(outer)
    });
  }

  endPlacement(): void {
    this.#assignPlacement(null);
  }

  reconcile(
    templateIds: Iterable<string>
  ): void {
    const known = new Set(templateIds);
    if (this.#placement !== null && !known.has(this.#placement.templateId)) {
      this.endPlacement();
    }
    if (this.#selected !== null && !known.has(this.#selected)) {
      this.selected = null;
    }
  }

  #assignPlacement(
    placement: TemplatePlacement | null
  ): void {
    this.#placement = placement === null ? null : Object.freeze(placement);
    this.emit("placementChange", this.#placement);
  }
}

function cellOf(
  position: VoxelCoord
): VoxelCoord {
  return Object.freeze({
    x: Math.round(position.x),
    y: Math.round(position.y),
    z: Math.round(position.z)
  });
}
