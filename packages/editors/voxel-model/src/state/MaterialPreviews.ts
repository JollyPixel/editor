// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  MaterialSurfaceJSON,
  MaterialSurfacePatchJSON
} from "@jolly-pixel/asset.voxel-model/client";

/**
 * `null` for this person, a client id for a peer.
 */
export type PreviewOwner = string | null;

export type MaterialPreviewsEvents = {
  change: (materialId: string, owner: PreviewOwner) => void;
};

export class MaterialPreviews extends Emitter<MaterialPreviewsEvents> {
  #layers = new Map<string, Map<PreviewOwner, MaterialSurfacePatchJSON>>();

  layer(
    materialId: string,
    owner: PreviewOwner
  ): MaterialSurfacePatchJSON | undefined {
    return this.#layers.get(materialId)?.get(owner);
  }

  set(
    materialId: string,
    owner: PreviewOwner,
    changes: MaterialSurfacePatchJSON
  ): void {
    const layers = this.#layers.get(materialId) ?? new Map();
    layers.set(owner, { ...changes });
    this.#layers.set(materialId, layers);
    this.emit("change", materialId, owner);
  }

  end(
    materialId: string,
    owner: PreviewOwner
  ): void {
    const layers = this.#layers.get(materialId);
    if (!layers?.delete(owner)) {
      return;
    }
    if (layers.size === 0) {
      this.#layers.delete(materialId);
    }
    this.emit("change", materialId, owner);
  }

  surfaceOf(
    materialId: string,
    stored: MaterialSurfaceJSON
  ): MaterialSurfaceJSON {
    const layers = this.#layers.get(materialId);
    if (layers === undefined) {
      return stored;
    }

    const peers = [...layers]
      .filter((entry): entry is [string, MaterialSurfacePatchJSON] => entry[0] !== null)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, changes]) => changes);

    let surface = stored;
    for (const changes of [...peers, layers.get(null) ?? {}]) {
      surface = {
        ...surface,
        ...changes
      };
    }

    return surface;
  }
}
