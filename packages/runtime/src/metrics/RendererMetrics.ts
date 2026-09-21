// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import type {
  MetricDefinition,
  MetricSource
} from "@jolly-pixel/ui/stats";

// CONSTANTS
const kDefaultGroup = "renderer";

export interface RendererMetricsOptions {
  /**
   * Folder a full readout files these metrics under.
   * @default "renderer"
   */
  group?: string;
  /**
   * Includes the metrics in the cycling `jolly-stats` tile.
   * @default false
   */
  tile?: boolean;
}

type MetricTraits = Pick<
  MetricDefinition,
  "unit" | "better" | "group" | "tile"
>;

export class RendererMetrics implements MetricSource {
  readonly metrics: readonly MetricDefinition[];

  #renderer: THREE.WebGPURenderer;
  #captured = false;
  #calls = 0;
  #triangles = 0;

  constructor(
    renderer: THREE.WebGPURenderer,
    options: RendererMetricsOptions = {}
  ) {
    this.#renderer = renderer;

    const traits: MetricTraits = {
      unit: "count",
      better: "lower",
      group: options.group ?? kDefaultGroup,
      tile: options.tile ?? false
    };
    this.metrics = [
      {
        ...traits,
        id: "calls",
        label: "draw calls",
        sample: () => (this.#captured ?
          this.#calls :
          renderer.info.render.drawCalls)
      },
      {
        ...traits,
        id: "renderedTriangles",
        label: "rendered tris",
        sample: () => (this.#captured ?
          this.#triangles :
          renderer.info.render.triangles)
      },
      {
        ...traits,
        id: "geometries",
        label: "geometries",
        sample: () => renderer.info.memory.geometries
      },
      {
        ...traits,
        id: "textures",
        label: "textures",
        sample: () => renderer.info.memory.textures
      }
    ];
  }

  captureFrame(): void {
    const { render } = this.#renderer.info;

    this.#captured = true;
    this.#calls = render.drawCalls;
    this.#triangles = render.triangles;
  }
}
