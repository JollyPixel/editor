// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  CanvasBuffer,
  type CanvasBufferEvent
} from "./buffer/CanvasBuffer.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "./buffer/hooks.ts";
import {
  History,
  type HistoryState
} from "./history/History.ts";
import type { HistoryEntry } from "./history/HistoryStack.types.ts";
import {
  DocumentEdits,
  type UVRegionFilter
} from "./sync/DocumentEdits.ts";
import type { FillGlobalCommit } from "./tools/FillEngine.ts";
import type { SelectEditEntry } from "./tools/SelectEngine.ts";
import { UVMap } from "./uv/map/UVMap.ts";
import {
  pointInGeometry,
  rectOf
} from "./uv/geometry/geometry.ts";
import type { UVGeometry } from "./uv/geometry/types.ts";
import { NormalMap } from "./normal/NormalMap.ts";
import { NormalMapConfig } from "./normal/NormalMapConfig.ts";
import { IslandMap } from "./normal/IslandMap.ts";
import type {
  IslandFace,
  NormalMapData,
  NormalMapSettings,
  NormalMapZone
} from "./normal/types.ts";
import type {
  UVRegion,
  UVRegionData
} from "./uv/region/UVRegion.ts";
import type {
  ByteColorInput,
  RGBA8,
  Vec2
} from "./types.ts";

// CONSTANTS
const kIslandEvents = [
  "region-created",
  "region-deleted",
  "region-moved",
  "region-state-changed",
  "region-rotated"
] as const;

export interface PixelDocumentOptions {
  size: Vec2;
  defaultColor?: ByteColorInput;
  maxSize?: number;
  init?: HTMLCanvasElement;
  history?: {
    enabled?: boolean;
    limit?: number;
    onChange?: (state: HistoryState) => void;
  };
  onBufferUpdated?: PixelBufferHookListener;
}

export type PixelDocumentEvent = CanvasBufferEvent & {
  "buffer-updated": (event: PixelBufferHookEvent) => void;
  "draw-end": () => void;
  "history-changed": (state: HistoryState) => void;
  "islands-changed": () => void;
  "normal-map-changed": (event: {
    config: NormalMapConfig | null;
    regionIds: string[] | null;
  }) => void;
  reset: () => void;
};

export class PixelDocument extends Emitter<
  PixelDocumentEvent
> {
  readonly buffer: CanvasBuffer;
  readonly uv: UVMap;
  readonly history: History;

  #edits: DocumentEdits;
  #onBufferUpdated: PixelBufferHookListener | undefined;
  #normals: NormalMap | null = null;
  #islands: IslandMap | null = null;
  #islandFaces: (() => Iterable<IslandFace>) | null = null;

  constructor(
    options: PixelDocumentOptions
  ) {
    super();

    this.buffer = new CanvasBuffer({
      size: options.size,
      defaultColor: options.defaultColor,
      maxSize: options.maxSize
    });

    if (options.init) {
      this.buffer.loadTexture(options.init);
    }

    this.uv = new UVMap({
      getCanvasSize: () => this.buffer.size()
    });

    const onHistoryChange = options.history?.onChange;
    this.history = new History(this.buffer, this.uv, {
      enabled: options.history?.enabled,
      limit: options.history?.limit,
      onChange: (state) => {
        onHistoryChange?.(state);
        this.emit("history-changed", state);
      }
    });

    this.#edits = new DocumentEdits({
      buffer: this.buffer,
      history: this.history,
      uvMap: this.uv,
      onDrawEnd: () => this.emit("draw-end"),
      onReset: () => this.emit("reset"),
      onNormalMapChanged: (regionIds) => this.emit("normal-map-changed", {
        config: this.normalMap,
        regionIds
      })
    });
    this.#onBufferUpdated = options.onBufferUpdated;
    this.#edits.onBufferUpdated = (event) => {
      this.#onBufferUpdated?.(event);
      this.emit("buffer-updated", event);
    };

    this.buffer.on("changed", (event) => this.emit("changed", event));
    this.buffer.on("resized", (event) => {
      this.invalidateIslands();
      this.emit("resized", event);
    });
    this.buffer.on("replaced", (event) => {
      this.invalidateIslands();
      this.emit("replaced", event);
    });
    for (const event of kIslandEvents) {
      this.uv.on(event, this.#onRegionsChanged);
    }
  }

  get onBufferUpdated(): PixelBufferHookListener | undefined {
    return this.#onBufferUpdated;
  }

  set onBufferUpdated(
    fn: PixelBufferHookListener | undefined
  ) {
    this.#onBufferUpdated = fn;
  }

  get normalMap(): NormalMapConfig | null {
    return this.#edits.normalMap;
  }

  get islands(): IslandMap {
    this.#islands ??= this.#islandFaces === null ?
      IslandMap.fromRegions(this.buffer.size(), this.uv.regions) :
      IslandMap.fromFaces(this.buffer.size(), this.#islandFaces());

    return this.#islands;
  }

  get normals(): NormalMap {
    this.#normals ??= new NormalMap({
      size: () => this.buffer.size(),
      pixels: () => this.buffer.pixels({ copy: false }),
      islands: () => this.islands,
      config: () => this.normalMap,
      connect: (normalMap) => this.#connectNormalMap(normalMap)
    });

    return this.#normals;
  }

  useIslandFaces(
    faces: () => Iterable<IslandFace>
  ): () => void {
    this.#islandFaces = faces;
    this.invalidateIslands();

    return () => {
      if (this.#islandFaces === faces) {
        this.#islandFaces = null;
        this.invalidateIslands();
      }
    };
  }

  invalidateIslands(): void {
    this.#islands = null;
    this.emit("islands-changed");
  }

  disownUvRegions(
    filter: UVRegionFilter
  ): () => void {
    return this.#edits.disownUvRegions(filter);
  }

  ownsUvRegion(
    id: string
  ): boolean {
    return this.#edits.ownsUvRegion(id);
  }

  size(): Vec2 {
    return this.buffer.size();
  }

  hasTransparency(
    geometry: UVGeometry
  ): boolean {
    if (!("shape" in geometry)) {
      return this.buffer.hasTransparency(geometry);
    }

    const bounds = rectOf(geometry);
    const maxX = Math.ceil(bounds.x + bounds.width);
    const maxY = Math.ceil(bounds.y + bounds.height);
    for (let y = Math.floor(bounds.y); y < maxY; y++) {
      for (let x = Math.floor(bounds.x); x < maxX; x++) {
        if (
          pointInGeometry(
            { x: x + 0.5, y: y + 0.5 },
            geometry
          ) &&
          this.buffer.samplePixel(x, y)[3] < 255
        ) {
          return true;
        }
      }
    }

    return false;
  }

  commitStroke(
    pixels: Vec2[],
    color: RGBA8,
    beforeColors: RGBA8[]
  ): void {
    this.#edits.commitStroke(pixels, color, beforeColors);
  }

  commitPixels(
    pixels: Vec2[],
    color: RGBA8,
    uniformBeforeColor?: RGBA8
  ): void {
    this.#edits.commitPixels(pixels, color, uniformBeforeColor);
  }

  commitGlobalFill(
    commit: FillGlobalCommit
  ): void {
    this.#edits.commitGlobalFill(commit);
  }

  commitSelectionEdit(
    entry: SelectEditEntry
  ): void {
    this.#edits.commitSelectionEdit(entry);
  }

  resize(
    size: Vec2
  ): void {
    this.#edits.resize(size);
  }

  replaceTexture(
    source: HTMLCanvasElement | HTMLImageElement
  ): void {
    this.#edits.replaceTexture(source);
  }

  clearTexture(
    keepMask?: Uint8Array
  ): void {
    this.#edits.clearTexture(keepMask);
  }

  enableNormalMap(
    config: NormalMapConfig = NormalMapConfig.create()
  ): void {
    this.#edits.toggleNormalMap(config);
  }

  disableNormalMap(): void {
    this.#edits.toggleNormalMap(null);
  }

  patchNormalMapDefaults(
    patch: Partial<NormalMapSettings>
  ): void {
    this.#edits.patchNormalMapDefaults(patch);
  }

  setNormalMapZone(
    zone: NormalMapZone
  ): void {
    this.#edits.setNormalMapZone(zone);
  }

  deleteNormalMapZone(
    regionId: string
  ): void {
    this.#edits.deleteNormalMapZone(regionId);
  }

  undo(): HistoryEntry | null {
    return this.#edits.undo();
  }

  redo(): HistoryEntry | null {
    return this.#edits.redo();
  }

  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.#edits.applyRemoteCommand(event);
  }

  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray,
    uvRegions: (UVRegion | UVRegionData)[] = [],
    normalMap: NormalMapData | null = null
  ): void {
    this.#edits.loadSnapshot(size, pixels, uvRegions, normalMap);
  }

  runLocalRestore<T>(
    fn: () => T
  ): T {
    return this.#edits.runLocalRestore(fn);
  }

  readonly #onRegionsChanged = (): void => {
    if (this.#islandFaces === null) {
      this.invalidateIslands();
    }
  };

  #connectNormalMap(
    normalMap: NormalMap
  ): () => void {
    const unsubscribers = [
      this.buffer.subscribe(
        "changed",
        (event) => normalMap.invalidate(event.bounds)
      ),
      this.subscribe("islands-changed", () => normalMap.invalidateIslands()),
      this.subscribe("normal-map-changed", (event) => {
        if (event.regionIds === null) {
          normalMap.invalidateAll();
        }
        else {
          normalMap.invalidateRegions(event.regionIds);
        }
      })
    ];

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }
}
