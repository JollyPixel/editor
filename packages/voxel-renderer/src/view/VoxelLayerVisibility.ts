// Import Internal Dependencies
import type {
  MeshableLayer,
  MeshableLayerVisibility
} from "./meshing/types.ts";

export class VoxelLayerVisibility implements MeshableLayerVisibility {
  #overrides = new Map<string, boolean>();
  #onChange: () => void;

  constructor(
    onChange: () => void = () => void 0
  ) {
    this.#onChange = onChange;
  }

  get overrides(): ReadonlyMap<string, boolean> {
    return this.#overrides;
  }

  isVisible(
    layer: MeshableLayer
  ): boolean {
    const override = layer.name === undefined ?
      undefined :
      this.#overrides.get(layer.name);

    return override ?? layer.visible;
  }

  override(
    layerName: string,
    visible: boolean
  ): void {
    if (this.#overrides.get(layerName) === visible) {
      return;
    }

    this.#overrides.set(layerName, visible);
    this.#onChange();
  }

  reset(
    layerName: string
  ): void {
    if (this.#overrides.delete(layerName)) {
      this.#onChange();
    }
  }

  clear(): void {
    if (this.#overrides.size > 0) {
      this.#overrides.clear();
      this.#onChange();
    }
  }
}
