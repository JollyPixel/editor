// Import Third-party Dependencies
import { Grid, type GridOptions } from "@jolly-pixel/three";
import { ActorComponent, Actor } from "@jolly-pixel/engine";

export type GridRendererOptions = GridOptions;

/**
 * Renders the voxel editor's floor grid using @jolly-pixel/three's `Grid`
 * (TSL, requires THREE.WebGPURenderer).
 */
export class GridRenderer extends ActorComponent {
  #options: GridRendererOptions;
  #grid: Grid | null = null;

  constructor(
    actor: Actor,
    options: GridRendererOptions = {}
  ) {
    super({
      actor,
      typeName: "GridRenderer"
    });

    this.#options = options;
    this.#build();
  }

  setExtent(
    value: number
  ): void {
    this.#options = { ...this.#options, extent: value };
    this.#clear();
    this.#build();
  }

  get visible(): boolean {
    return this.#options.enabled ?? true;
  }

  setVisible(
    value: boolean
  ): void {
    this.#options = { ...this.#options, enabled: value };
    if (this.#grid) {
      this.#grid.enabled = value;
    }
  }

  override destroy(): void {
    this.#clear();
    super.destroy();
  }

  #build(): void {
    this.#grid = new Grid(this.#options);
    this.actor.addChildren(this.#grid);
  }

  #clear(): void {
    if (this.#grid) {
      this.actor.removeChildren(this.#grid);
      this.#grid = null;
    }
  }
}
