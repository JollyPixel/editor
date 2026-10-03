// Import Internal Dependencies
import { RectArea } from "../utils/RectArea.ts";
import { DEFAULT_NORMAL_MAP_SETTINGS } from "./NormalMapConfig.ts";
import type {
  Island,
  NormalMapInput,
  NormalMapSettings
} from "./types.ts";
import type { SelectionRect } from "../types.ts";

interface IslandJobPlan {
  settings: Readonly<NormalMapSettings>;
  off: boolean;
  wraps: boolean;
  target: SelectionRect;
  window: SelectionRect;
}

export class IslandJob {
  readonly pixels: Uint8Array | Uint8ClampedArray;
  readonly indices: Int32Array;
  readonly width: number;
  readonly height: number;
  readonly index: number;
  readonly settings: Readonly<NormalMapSettings>;
  readonly off: boolean;
  readonly target: Readonly<SelectionRect>;
  readonly window: Readonly<SelectionRect>;
  readonly wraps: boolean;
  readonly #bounds: Readonly<SelectionRect>;

  static plan(
    input: NormalMapInput,
    island: Island,
    area?: SelectionRect
  ): IslandJob | null {
    const resolved = input.config?.resolve(island.regionIds) ?? "off";
    const off = resolved === "off";
    const settings = off ? DEFAULT_NORMAL_MAP_SETTINGS : resolved;
    const { bounds } = island;
    const islandArea = RectArea.from(bounds);
    const wholeIsland = area === undefined || (
      !off &&
      (settings.height === "regions" || settings.border === "bevel")
    );

    let target = wholeIsland ?
      islandArea :
      RectArea.from(area).clippedTo(bounds);
    if (target === null) {
      return null;
    }

    const wraps = !off && settings.border === "wrap" && island.isRect;
    if (wraps && target.touchesEdgeOf(bounds)) {
      target = islandArea;
    }

    return new IslandJob(input, island, {
      settings,
      off,
      wraps,
      target: target.bounds,
      window: (target.grown(1).clippedTo(bounds) ?? target).bounds
    });
  }

  constructor(
    input: NormalMapInput,
    island: Island,
    plan: IslandJobPlan
  ) {
    this.pixels = input.pixels;
    this.indices = input.islands.indices;
    this.width = input.size.x;
    this.height = input.size.y;
    this.index = island.index;
    this.#bounds = island.bounds;
    this.settings = plan.settings;
    this.off = plan.off;
    this.wraps = plan.wraps;
    this.target = plan.target;
    this.window = plan.window;
  }

  get area(): number {
    return this.window.width * this.window.height;
  }

  neighbour(
    x: number,
    y: number
  ): number {
    let nx = x;
    let ny = y;
    if (this.wraps) {
      const bounds = this.#bounds;
      if (nx < bounds.x) {
        nx += bounds.width;
      }
      else if (nx >= bounds.x + bounds.width) {
        nx -= bounds.width;
      }
      if (ny < bounds.y) {
        ny += bounds.height;
      }
      else if (ny >= bounds.y + bounds.height) {
        ny -= bounds.height;
      }
    }
    if (
      nx < 0 || ny < 0 ||
      nx >= this.width || ny >= this.height ||
      this.indices[(ny * this.width) + nx] !== this.index
    ) {
      return this.area;
    }

    return ((ny - this.window.y) * this.window.width) + nx - this.window.x;
  }

  bevel(
    distance: number
  ): number {
    const { width, profile } = this.settings.bevel;
    const t = Math.min(distance, width) / width;

    return profile === "linear" ?
      t :
      Math.sqrt(1 - ((1 - t) * (1 - t)));
  }
}
