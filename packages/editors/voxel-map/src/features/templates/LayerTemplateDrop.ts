// Import Third-party Dependencies
import type {
  TreeDragOut,
  TreeDragOutPoint
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  parseLayerRef,
  type LayerRef,
  type VoxelLayerRef
} from "../../state/index.ts";

export type DropZoneBounds = Pick<
  DOMRectReadOnly,
  "left" | "right" | "top" | "bottom"
>;

export interface TemplateDropZone {
  bounds(): DropZoneBounds | null;
  highlight(active: boolean): void;
}

export interface LayerTemplateDropOptions {
  zone: TemplateDropZone;
  editable(): boolean;
  save(layerName: string): void;
}

export class LayerTemplateDrop implements TreeDragOut {
  readonly #zone: TemplateDropZone;
  readonly #editable: () => boolean;
  readonly #save: (layerName: string) => void;

  constructor(
    options: LayerTemplateDropOptions
  ) {
    this.#zone = options.zone;
    this.#editable = options.editable;
    this.#save = options.save;
  }

  over(
    drag: TreeDragOutPoint
  ): boolean {
    const bounds = this.#zone.bounds();
    const inside = bounds !== null &&
      drag.clientX >= bounds.left &&
      drag.clientX <= bounds.right &&
      drag.clientY >= bounds.top &&
      drag.clientY <= bounds.bottom;
    const claimed = inside &&
      this.#editable() &&
      voxelLayers(drag.movedIds) !== null;
    if (claimed) {
      this.#zone.highlight(true);
    }

    return claimed;
  }

  drop(
    drag: TreeDragOutPoint
  ): void {
    this.#zone.highlight(false);
    for (const layer of voxelLayers(drag.movedIds) ?? []) {
      this.#save(layer.name);
    }
  }

  leave(): void {
    this.#zone.highlight(false);
  }
}

function voxelLayers(
  ids: readonly string[]
): VoxelLayerRef[] | null {
  const refs = ids.map(parseLayerRef);

  return refs.length > 0 && refs.every(isVoxelLayer) ? refs : null;
}

function isVoxelLayer(
  ref: LayerRef
): ref is VoxelLayerRef {
  return ref.kind === "voxel-layer";
}
