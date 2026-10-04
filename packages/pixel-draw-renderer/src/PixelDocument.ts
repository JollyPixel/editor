// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  CanvasBuffer,
  type CanvasBufferEvent
} from "./buffer/CanvasBuffer.ts";
import {
  History,
  type HistoryState
} from "./history/History.ts";
import type {
  HistoryEdit,
  HistoryEntry
} from "./history/HistoryEntry.ts";
import { PixelDocumentState } from "./sync/PixelDocumentState.ts";
import { EditRecorder } from "./sync/EditRecorder.ts";
import {
  selectEditOf,
  strokeOf,
  strokesOf,
  textureOf,
  type DocumentCommand,
  type PixelCommand
} from "./sync/PixelCommand.ts";
import { NormalMapChange } from "./sync/NormalMapChange.ts";
import {
  UVOwnership,
  type UVRegionFilter
} from "./sync/UVOwnership.ts";
import type {
  GlobalFill,
  SelectionEdit
} from "./sync/LocalEdit.types.ts";
import type { UVMap } from "./uv/map/UVMap.ts";
import {
  coveredPixels,
  rectOf
} from "./uv/geometry/geometry.ts";
import type { UVGeometry } from "./uv/geometry/types.ts";
import { RectArea } from "./utils/RectArea.ts";
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
  };
}

export type PixelDocumentEvent = CanvasBufferEvent & {
  command: (command: PixelCommand) => void;
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

  #state: PixelDocumentState<CanvasBuffer>;
  #ownership: UVOwnership;
  #recorder: EditRecorder;
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

    this.#state = new PixelDocumentState({
      buffer: this.buffer,
      onNormalMapChanged: (regionIds) => this.emit("normal-map-changed", {
        config: this.normalMap,
        regionIds
      })
    });
    this.uv = this.#state.uv;
    this.history = new History({
      enabled: options.history?.enabled,
      limit: options.history?.limit,
      onChange: (state) => this.emit("history-changed", state)
    });
    this.#ownership = new UVOwnership({
      uv: this.uv,
      isRecording: () => this.#recorder.recording,
      removeNormalMapZoneOf: (regionId) => this.#state.removeNormalMapZoneOf(regionId),
      record: (edit) => this.#recorder.record(edit.redo, edit)
    });
    this.#recorder = new EditRecorder({
      state: this.#state,
      history: this.history,
      ownership: this.#ownership,
      listeners: {
        command: (command) => this.emit("command", command),
        drawEnd: () => this.emit("draw-end"),
        reset: () => this.emit("reset")
      }
    });

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

  get normalMap(): NormalMapConfig | null {
    return this.#state.normalMap;
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
    return this.#ownership.disown(filter);
  }

  ownsUvRegion(
    id: string
  ): boolean {
    return this.#ownership.owns(id);
  }

  size(): Vec2 {
    return this.buffer.size();
  }

  hasTransparency(
    geometry: UVGeometry
  ): boolean {
    const size = this.buffer.size();
    const area = RectArea.from(rectOf(geometry));
    if (area.isEmpty) {
      return false;
    }
    if (!area.fitsWithin(size)) {
      return true;
    }

    const pixels = this.buffer.pixels({ copy: false });
    for (const index of coveredPixels(geometry, size)) {
      if (pixels[(index * 4) + 3] < 255) {
        return true;
      }
    }

    return false;
  }

  paintPixels(
    pixels: Vec2[],
    color: RGBA8,
    beforeColor?: RGBA8
  ): void {
    if (pixels.length === 0) {
      return;
    }

    const undo = this.#undoable(() => (beforeColor ?
      [strokeOf(pixels, beforeColor)] :
      strokesOf(pixels, this.buffer.samplePixels(pixels))));
    const stroke = strokeOf(pixels, color);
    this.#state.apply(stroke);
    this.#commitDrawing([stroke], { redo: [stroke], undo });
  }

  paintGlobalFill(
    fill: GlobalFill
  ): void {
    const { positions, fromColor, toColor } = fill;
    const stroke = strokeOf(positions, toColor);

    this.#state.apply(stroke);
    this.#commitDrawing(
      [{ action: "global-fill", metadata: { fromColor, toColor } }],
      { redo: [stroke], undo: [strokeOf(positions, fromColor)] }
    );
  }

  recordStroke(
    pixels: Vec2[],
    color: RGBA8,
    beforeColors: RGBA8[]
  ): void {
    const stroke = strokeOf(pixels, color);

    this.#commitDrawing([stroke], {
      redo: [stroke],
      undo: this.#undoable(() => strokesOf(pixels, beforeColors))
    });
  }

  paintSelectionEdit(
    edit: SelectionEdit
  ): void {
    const { positions, before, after } = edit;
    const redo = selectEditOf(positions, edit.afterColors);

    this.#state.apply(redo);
    this.#commitDrawing([redo], {
      redo: [redo],
      undo: [selectEditOf(positions, edit.beforeColors)],
      selection: { before, after }
    });
  }

  resize(
    size: Vec2
  ): void {
    const undo = this.#textureSnapshot();
    const resized: DocumentCommand = {
      action: "resized",
      metadata: { size: structuredClone(size) }
    };

    this.#state.apply(resized);
    this.#recorder.record([resized], { redo: this.#textureSnapshot(), undo });
  }

  replaceTexture(
    source: HTMLCanvasElement | HTMLImageElement
  ): void {
    this.#commitTexture(() => this.buffer.loadTexture(source));
  }

  clearTexture(
    keepMask?: Uint8Array
  ): void {
    const pixels = this.buffer.pixels();
    if (keepMask) {
      for (let index = 0; index < keepMask.length; index++) {
        if (keepMask[index] === 0) {
          const byteIndex = index * 4;
          pixels[byteIndex] = 0;
          pixels[byteIndex + 1] = 0;
          pixels[byteIndex + 2] = 0;
          pixels[byteIndex + 3] = 0;
        }
      }
    }
    else {
      pixels.fill(0);
    }

    this.#commitTexture(() => this.buffer.replacePixels(pixels, this.buffer.size()));
  }

  enableNormalMap(
    config: NormalMapConfig = NormalMapConfig.create()
  ): void {
    this.#commitNormalMap(NormalMapChange.toggle(this.normalMap, config));
  }

  disableNormalMap(): void {
    this.#commitNormalMap(NormalMapChange.toggle(this.normalMap, null));
  }

  patchNormalMapDefaults(
    patch: Partial<NormalMapSettings>
  ): void {
    this.#commitNormalMap(NormalMapChange.patchDefaults(this.normalMap, patch));
  }

  setNormalMapZone(
    zone: NormalMapZone
  ): void {
    this.#commitNormalMap(NormalMapChange.setZone(this.normalMap, zone));
  }

  deleteNormalMapZone(
    regionId: string
  ): void {
    this.#commitNormalMap(NormalMapChange.deleteZone(this.normalMap, regionId));
  }

  undo(): HistoryEntry | null {
    return this.#recorder.undo();
  }

  redo(): HistoryEntry | null {
    return this.#recorder.redo();
  }

  applyRemoteCommand(
    command: PixelCommand
  ): void {
    this.#recorder.applyRemote(command);
  }

  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray,
    uvRegions: (UVRegion | UVRegionData)[] = [],
    normalMap: NormalMapData | null = null
  ): void {
    this.#recorder.load({
      size,
      pixels,
      uvRegions,
      normalMap
    });
  }

  runLocalRestore<T>(
    fn: () => T
  ): T {
    return this.#recorder.silently(fn);
  }

  readonly #onRegionsChanged = (): void => {
    if (this.#islandFaces === null) {
      this.invalidateIslands();
    }
  };

  #undoable(
    build: () => DocumentCommand[]
  ): DocumentCommand[] {
    return this.history.enabled && this.#recorder.recording ? build() : [];
  }

  #textureSnapshot(): DocumentCommand[] {
    return this.#undoable(() => [
      textureOf(this.buffer.size(), this.buffer.pixels())
    ]);
  }

  #commitTexture(
    replace: () => void
  ): void {
    const undo = this.#textureSnapshot();
    replace();

    this.#recorder.record(
      [textureOf(this.buffer.size(), this.buffer.pixels({ copy: false }))],
      { redo: this.#textureSnapshot(), undo }
    );
  }

  #commitNormalMap(
    change: NormalMapChange | null
  ): void {
    if (change === null) {
      return;
    }

    this.#state.apply(change.redo);
    this.#recorder.record([change.redo], { redo: [change.redo], undo: [change.undo] });
  }

  #commitDrawing(
    emitted: DocumentCommand[],
    edit: HistoryEdit
  ): void {
    this.#recorder.record(emitted, edit);
    this.emit("draw-end");
  }

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
