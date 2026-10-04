// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { IslandMap } from "./IslandMap.ts";
import type { NormalMapConfig } from "./NormalMapConfig.ts";
import { NormalMapGenerator } from "./NormalMapGenerator.ts";
import { RectArea } from "../utils/RectArea.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";

export interface NormalMapSource {
  size(): Vec2;
  pixels(): Uint8Array | Uint8ClampedArray;
  islands(): IslandMap;
  config(): NormalMapConfig | null;
  connect(
    normalMap: NormalMap
  ): () => void;
}

interface NormalMapPreview {
  config: NormalMapConfig;
  base: NormalMapConfig;
}

export type NormalMapEvent = {
  changed: (
    event: { bounds: SelectionRect; }
  ) => void;
  resized: (
    event: { size: Vec2; }
  ) => void;
};

export class NormalMap extends Emitter<NormalMapEvent> {
  #source: NormalMapSource;
  #generator = new NormalMapGenerator();
  #output = new Uint8ClampedArray(0);
  #size: Vec2 = { x: 0, y: 0 };
  #islands: IslandMap | null = null;
  #preview: NormalMapPreview | null = null;
  #retainers = 0;
  #disconnect: (() => void) | null = null;
  #frame: number | null = null;
  #dirtyAll = true;
  #dirtyRegions = new Set<string>();
  #dirtyRects: SelectionRect[] = [];

  constructor(
    source: NormalMapSource
  ) {
    super();
    this.#source = source;
  }

  get size(): Vec2 {
    return { ...this.#size };
  }

  get pixels(): Uint8ClampedArray {
    return this.#output;
  }

  get islands(): IslandMap {
    if (!this.retained) {
      return this.#source.islands();
    }

    this.#islands ??= this.#source.islands();

    return this.#islands;
  }

  get config(): NormalMapConfig | null {
    const committed = this.#source.config();

    return this.#preview?.base === committed ?
      this.#preview.config :
      committed;
  }

  preview(
    config: NormalMapConfig | null
  ): void {
    const base = this.#source.config();
    this.#preview = config === null || base === null ?
      null :
      { config, base };
    this.invalidateAll();
  }

  get retained(): boolean {
    return this.#retainers > 0;
  }

  retain(): () => void {
    this.#retainers++;
    if (this.#retainers === 1) {
      this.#disconnect = this.#source.connect(this);
      this.invalidateAll();
    }

    let released = false;

    return () => {
      if (released) {
        return;
      }
      released = true;
      this.#retainers--;
      if (this.#retainers === 0) {
        this.#release();
      }
    };
  }

  invalidate(
    bounds: SelectionRect
  ): void {
    this.#dirtyRects.push({
      ...bounds
    });
    this.#schedule();
  }

  invalidateRegions(
    regionIds: Iterable<string>
  ): void {
    for (const regionId of regionIds) {
      this.#dirtyRegions.add(regionId);
    }
    this.#schedule();
  }

  invalidateIslands(): void {
    this.#islands = null;
    this.invalidateAll();
  }

  invalidateAll(): void {
    this.#dirtyAll = true;
    this.#schedule();
  }

  flush(): void {
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
    if (!this.retained) {
      return;
    }

    if (
      this.#preview !== null &&
      this.#preview.base !== this.#source.config()
    ) {
      this.#preview = null;
      this.#dirtyAll = true;
    }

    const size = this.#source.size();
    if (
      size.x !== this.#size.x ||
      size.y !== this.#size.y
    ) {
      this.#size = { x: size.x, y: size.y };
      this.#output = new Uint8ClampedArray(
        size.x * size.y * 4
      );
      this.#islands = null;
      this.#dirtyAll = true;
      this.emit("resized", { size: this.size });
    }

    const bounds = this.#regenerate();
    this.#dirtyAll = false;
    this.#dirtyRegions.clear();
    this.#dirtyRects = [];
    if (bounds !== null) {
      this.emit("changed", { bounds });
    }
  }

  #regenerate(): SelectionRect | null {
    const islands = this.islands;
    const input = {
      size: this.#size,
      pixels: this.#source.pixels(),
      islands,
      config: this.config
    };

    if (this.#dirtyAll) {
      for (const island of islands.islands) {
        this.#generator.writeIsland(
          input,
          this.#output,
          island
        );
      }

      return {
        x: 0,
        y: 0,
        width: this.#size.x,
        height: this.#size.y
      };
    }

    const areas = new Map<number, RectArea>();
    for (const regionId of this.#dirtyRegions) {
      for (const island of islands.islandsOf(regionId)) {
        areas.set(island.index, RectArea.from(island.bounds));
      }
    }
    for (const rect of this.#dirtyRects) {
      const grown = RectArea.from(rect).grown(1);
      for (const island of islands.islandsWithin(grown.bounds)) {
        const area = areas.get(island.index);
        areas.set(island.index, area === undefined ? grown : area.union(grown.bounds));
      }
    }

    let written: RectArea | null = null;
    for (const [index, area] of areas) {
      const rect = this.#generator.writeIsland(
        input,
        this.#output,
        islands.islands[index],
        area.bounds
      );
      if (rect !== null) {
        written = written === null
          ? RectArea.from(rect)
          : written.union(rect);
      }
    }

    return written?.bounds ?? null;
  }

  #schedule(): void {
    if (!this.retained || this.#frame !== null) {
      return;
    }

    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      this.flush();
    });
  }

  #release(): void {
    this.#disconnect?.();
    this.#disconnect = null;

    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }

    this.#output = new Uint8ClampedArray(0);
    this.#size = { x: 0, y: 0 };
    this.#islands = null;
    this.#dirtyAll = true;
    this.#dirtyRegions.clear();
    this.#dirtyRects = [];
  }
}
