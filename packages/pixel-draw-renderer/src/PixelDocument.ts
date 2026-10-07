// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  ChangeReceipts,
  type DocumentResetCause
} from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  CanvasBuffer,
  type CanvasBufferEvent
} from "./buffer/CanvasBuffer.ts";
import { PixelDocumentState } from "./sync/PixelDocumentState.ts";
import {
  EditRecorder,
  type EditGrouping
} from "./sync/EditRecorder.ts";
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
  LocalEdit,
  PixelChange,
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
import { ColorPalette } from "./palette/ColorPalette.ts";
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
}

export type PixelDocumentEvent = CanvasBufferEvent & {
  command: (command: PixelCommand, change: PixelChange) => void;
  change: (change: PixelChange) => void;
  "draw-end": () => void;
  "islands-changed": () => void;
  "palette-changed": (index: number | null) => void;
  "normal-map-changed": (event: {
    config: NormalMapConfig | null;
    regionIds: string[] | null;
  }) => void;
  reset: (cause: DocumentResetCause) => void;
};

export class PixelDocument extends Emitter<
  PixelDocumentEvent
> {
  readonly buffer: CanvasBuffer;
  readonly uv: UVMap;
  readonly receipts = new ChangeReceipts<PixelChange>();

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
      onPaletteChanged: (index) => this.emit("palette-changed", index),
      uv: {
        batch: (apply) => this.#recorder.batch(apply)
      },
      onNormalMapChanged: (regionIds) => this.emit("normal-map-changed", {
        config: this.normalMap,
        regionIds
      })
    });
    this.uv = this.#state.uv;
    this.#ownership = new UVOwnership({
      uv: this.uv,
      isRecording: () => this.#recorder.recording,
      removeNormalMapZoneOf: (regionId) => this.#state.removeNormalMapZoneOf(regionId),
      record: (edit) => this.#recorder.record(edit)
    });
    this.#recorder = new EditRecorder({
      state: this.#state,
      ownership: this.#ownership,
      listeners: {
        change: (change) => this.emit("change", change),
        command: (command, change) => this.emit("command", command, change),
        drawEnd: () => this.emit("draw-end"),
        load: () => this.emit("reset", "load")
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

  get palette(): ColorPalette {
    return this.#state.palette;
  }

  changePaletteColor(
    index: number,
    color: RGBA8
  ): void {
    const palette = this.palette.withColor(index, color);
    if (palette === this.palette) {
      return;
    }

    const undo: DocumentCommand = {
      action: "palette-color-changed",
      metadata: { index, color: this.palette.colorAt(index) }
    };
    const redo: DocumentCommand = {
      action: "palette-color-changed",
      metadata: { index, color: palette.colorAt(index) }
    };
    this.#state.apply(redo);
    this.#recorder.record({ command: redo, inverse: [undo] });
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

    const inverse = this.#undoable(() => (beforeColor ?
      [strokeOf(pixels, beforeColor)] :
      strokesOf(pixels, this.buffer.samplePixels(pixels))));
    const stroke = strokeOf(pixels, color);
    this.#state.apply(stroke);
    this.#commitDrawing({ command: stroke, inverse });
  }

  paintGlobalFill(
    fill: GlobalFill
  ): void {
    const { positions, fromColor, toColor } = fill;
    const stroke = strokeOf(positions, toColor);

    this.#state.apply(stroke);
    this.#commitDrawing({
      command: stroke,
      inverse: [strokeOf(positions, fromColor)],
      sent: { action: "global-fill", metadata: { fromColor, toColor } }
    });
  }

  recordStroke(
    pixels: Vec2[],
    color: RGBA8,
    beforeColors: RGBA8[]
  ): void {
    this.#commitDrawing({
      command: strokeOf(pixels, color),
      inverse: this.#undoable(() => strokesOf(pixels, beforeColors))
    });
  }

  paintSelectionEdit(
    edit: SelectionEdit
  ): void {
    const { positions } = edit;
    const redo = selectEditOf(positions, edit.afterColors);

    this.#state.apply(redo);
    this.#commitDrawing({
      command: redo,
      inverse: [selectEditOf(positions, edit.beforeColors)]
    });
  }

  resize(
    size: Vec2
  ): void {
    const inverse = this.#textureSnapshot();
    const resized: DocumentCommand = {
      action: "resized",
      metadata: { size: structuredClone(size) }
    };

    this.#state.apply(resized);
    this.#recorder.record({ command: resized, inverse });
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

  applyStep(
    command: DocumentCommand,
    basis: number | undefined
  ): PixelChange | null {
    return this.#recorder.applyStep(command, basis);
  }

  applyRemoteCommand(
    command: PixelCommand,
    clientId: string | null = null
  ): void {
    this.#recorder.applyRemote(command, clientId);
  }

  replayPendingCommand(
    command: PixelCommand
  ): void {
    this.#recorder.replayPending(command);
  }

  batch<T>(
    edit: () => T
  ): T {
    return this.#recorder.batch(edit);
  }

  groupEditsWith(
    grouping: EditGrouping
  ): () => void {
    return this.#recorder.groupWith(grouping);
  }

  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray,
    uvRegions: (UVRegion | UVRegionData)[] = [],
    normalMap: NormalMapData | null = null,
    palette?: readonly RGBA8[]
  ): void {
    this.#recorder.load({
      size,
      pixels,
      uvRegions,
      normalMap,
      palette
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
    return this.#recorder.recording ? build() : [];
  }

  #textureSnapshot(): DocumentCommand[] {
    return this.#undoable(() => [
      textureOf(this.buffer.size(), this.buffer.pixels())
    ]);
  }

  #commitTexture(
    replace: () => void
  ): void {
    const inverse = this.#textureSnapshot();
    replace();

    this.#recorder.record({
      command: textureOf(this.buffer.size(), this.buffer.pixels({ copy: false })),
      inverse
    });
  }

  #commitNormalMap(
    change: NormalMapChange | null
  ): void {
    if (change === null) {
      return;
    }

    this.#state.apply(change.redo);
    this.#recorder.record({ command: change.redo, inverse: [change.undo] });
  }

  #commitDrawing(
    edit: LocalEdit
  ): void {
    this.#recorder.record(edit);
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
