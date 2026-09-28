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

export interface RendererFrameStats {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

type MetricTraits = Pick<
  MetricDefinition,
  "unit" | "better" | "group" | "tile"
>;

export class RendererMetrics implements MetricSource {
  readonly metrics: readonly MetricDefinition[];

  #renderer: THREE.WebGPURenderer;
  #captured = false;
  #capturedDrawCalls = 0;
  #capturedTriangles = 0;

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
        sample: () => this.#drawCalls
      },
      {
        ...traits,
        id: "renderedTriangles",
        label: "rendered tris",
        sample: () => this.#triangles
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
      },
      {
        ...traits,
        id: "geometryMemory",
        label: "geometry memory",
        unit: "bytes",
        sample: () => {
          const { attributesSize, indexAttributesSize } = renderer.info.memory;

          return attributesSize + indexAttributesSize;
        }
      },
      {
        ...traits,
        id: "textureMemory",
        label: "texture memory",
        unit: "bytes",
        sample: () => renderer.info.memory.texturesSize
      }
    ];
  }

  get frame(): RendererFrameStats {
    const { memory } = this.#renderer.info;

    return {
      drawCalls: this.#drawCalls,
      triangles: this.#triangles,
      geometries: memory.geometries,
      textures: memory.textures
    };
  }

  get #drawCalls(): number {
    return this.#captured ?
      this.#capturedDrawCalls :
      this.#renderer.info.render.drawCalls;
  }

  get #triangles(): number {
    return this.#captured ?
      this.#capturedTriangles :
      this.#renderer.info.render.triangles;
  }

  captureFrame(): void {
    const { render } = this.#renderer.info;

    this.#captured = true;
    this.#capturedDrawCalls = render.drawCalls;
    this.#capturedTriangles = render.triangles;
  }
}
