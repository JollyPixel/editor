// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelTransformOptions
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { TemplatePlacement } from "./TemplatePlacement.ts";

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
    this.#assignPlacement(TemplatePlacement.at(templateId, position));
  }

  movePlacement(
    position: VoxelCoord
  ): void {
    this.#assignPlacement(this.#placement?.movedTo(position) ?? null);
  }

  transformPlacement(
    transform: VoxelTransformOptions
  ): void {
    this.#assignPlacement(this.#placement?.turnedBy(transform) ?? null);
  }

  endPlacement(): void {
    if (this.#placement !== null) {
      this.#placement = null;
      this.emit("placementChange", null);
    }
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
    if (placement === null || placement.equals(this.#placement)) {
      return;
    }

    this.#placement = placement;
    this.emit("placementChange", placement);
  }
}
