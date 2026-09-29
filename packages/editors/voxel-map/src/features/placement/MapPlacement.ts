// Import Third-party Dependencies
import {
  VoxelTransform,
  type VoxelCoord,
  type VoxelHistory,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { SelectionStore } from "../../state/index.ts";
import type { Placement } from "./Placement.ts";
import {
  LayerSource,
  TemplateSource
} from "./PlacementSource.ts";
import { PlacementStore } from "./PlacementStore.ts";

export type LayerConcealer = (layerName: string) => () => void;

export interface MapPlacementOptions {
  world: VoxelWorld;
  history: Pick<VoxelHistory, "begin" | "commit">;
  selection: Pick<SelectionStore, "lastVoxelLayer">;
  store?: PlacementStore;
  conceal?: LayerConcealer;
}

export class MapPlacement {
  readonly store: PlacementStore;

  readonly #world: VoxelWorld;
  readonly #history: Pick<VoxelHistory, "begin" | "commit">;
  readonly #selection: Pick<SelectionStore, "lastVoxelLayer">;
  readonly #conceal: LayerConcealer | null;
  #concealed: {
    layerName: string;
    release: () => void;
  } | null = null;

  #unsubscribe: () => void;

  constructor(
    options: MapPlacementOptions
  ) {
    this.#world = options.world;
    this.#history = options.history;
    this.#selection = options.selection;
    this.#conceal = options.conceal ?? null;
    this.store = options.store ?? new PlacementStore();
    this.#unsubscribe = this.store.subscribe("change", this.#syncConcealed);
  }

  get target(): string | null {
    const source = this.store.placement?.source;
    if (source === undefined) {
      return null;
    }

    return source.kind === "layer" ?
      source.layerName :
      this.#selection.lastVoxelLayer;
  }

  placeTemplate(
    templateId: string,
    position: VoxelCoord
  ): boolean {
    if (this.#world.templates.get(templateId) === undefined) {
      return false;
    }
    this.store.begin(new TemplateSource(templateId), position);

    return true;
  }

  transformLayer(
    layerName: string
  ): boolean {
    const source = LayerSource.capture(this.#world, layerName);
    if (source === null) {
      return false;
    }
    this.store.begin(source, source.pivot);

    return true;
  }

  transforming(
    layerName: string
  ): boolean {
    const source = this.store.placement?.source;

    return source?.kind === "layer" && source.layerName === layerName;
  }

  commit(): boolean {
    const { placement } = this.store;
    const layerName = this.target;
    if (placement === null || layerName === null) {
      return false;
    }

    this.#history.begin();
    let committed = false;
    try {
      committed = placement.source.kind === "layer" ?
        this.#moveLayer(placement, placement.source) :
        this.#world.templates.place(placement.source.templateId, {
          layerName,
          position: placement.position,
          transform: placement.transform
        });
    }
    finally {
      this.#history.commit();
    }
    if (committed) {
      this.store.end();
    }

    return committed;
  }

  cancel(): boolean {
    const placing = this.store.placing;
    this.store.end();

    return placing;
  }

  dispose(): void {
    this.#unsubscribe();
    this.#release();
  }

  #moveLayer(
    placement: Placement,
    source: LayerSource
  ): boolean {
    const { layerName } = source;
    if (this.#world.getLayer(layerName) === undefined) {
      return false;
    }

    if (!placement.transform.equals(VoxelTransform.Identity)) {
      this.#world.transformLayer(layerName, placement.transform);
    }

    const bounds = this.#world.getLayer(layerName)?.worldBounds() ?? null;
    if (bounds === null) {
      return true;
    }

    const { min } = placement.boundsIn(source.snapshot);
    const delta = {
      x: min.x - bounds.min.x,
      y: min.y - bounds.min.y,
      z: min.z - bounds.min.z
    };
    if (delta.x !== 0 || delta.y !== 0 || delta.z !== 0) {
      this.#world.translateLayer(layerName, delta);
    }

    return true;
  }

  readonly #syncConcealed = (
    placement: Placement | null
  ): void => {
    const source = placement?.source;
    const layerName = source?.kind === "layer" ? source.layerName : null;
    if (this.#concealed?.layerName === layerName) {
      return;
    }

    this.#release();
    if (layerName !== null && this.#conceal !== null) {
      this.#concealed = {
        layerName,
        release: this.#conceal(layerName)
      };
    }
  };

  #release(): void {
    this.#concealed?.release();
    this.#concealed = null;
  }
}
