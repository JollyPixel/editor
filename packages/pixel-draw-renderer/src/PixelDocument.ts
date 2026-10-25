// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  CanvasBuffer,
  type CanvasBufferEvent
} from "./buffer/CanvasBuffer.ts";
import {
  PixelDocumentState,
  type PixelDocumentSnapshot
} from "./sync/PixelDocumentState.ts";
import {
  EditRecorder,
  type EditGrouping
} from "./sync/EditRecorder.ts";
import {
  selectEditCommand,
  strokeCommand,
  strokeCommands,
  textureCommand,
  uvNetDefaultChanged,
  uvNetDeleted,
  uvNetSaved,
  type PixelDocumentCommand,
  type PixelCommand,
  type UVNetCommand
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
import type { EditSource } from "./sync/EditChange.ts";
import type { UVMap } from "./uv/map/UVMap.ts";
import {
  coveredPixels,
  boundingRect
} from "./uv/geometry/geometry.ts";
import type { UVGeometry } from "./uv/geometry/types.ts";
import { RectArea } from "./utils/RectArea.ts";
import { NormalMap } from "./normal/NormalMap.ts";
import { NormalMapConfig } from "./normal/NormalMapConfig.ts";
import { ColorPalette } from "./palette/ColorPalette.ts";
import { IslandMap } from "./normal/IslandMap.ts";
import type {
  IslandFace,
  NormalMapSettings,
  NormalMapZone
} from "./normal/types.ts";
import type { UVNetSet } from "./uv/region/UVNetSet.ts";
import type { SavedUVNetData } from "./uv/region/SavedUVNet.ts";
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
  "uv-nets-changed": () => void;
  "normal-map-changed": (event: {
    config: NormalMapConfig | null;
    regionIds: string[] | null;
  }) => void;
  reset: (cause: "load") => void;
};

export class PixelDocument extends Emitter<
  PixelDocumentEvent
>
  implements EditSource<PixelDocumentCommand> {
  readonly buffer: CanvasBuffer;
  readonly uv: UVMap;

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
      onUvNetsChanged: () => this.emit("uv-nets-changed"),
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
      removeNormalMapZone: (regionId) => this.#state.removeNormalMapZone(regionId),
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

    const undo: PixelDocumentCommand = {
      action: "palette-color-changed",
      metadata: { index, color: this.palette.colorAt(index) }
    };
    const redo: PixelDocumentCommand = {
      action: "palette-color-changed",
      metadata: { index, color: palette.colorAt(index) }
    };
    this.#state.apply(redo);
    this.#recorder.record({ command: redo, inverse: [undo] });
  }

  get uvNets(): UVNetSet {
    return this.#state.uvNets;
  }

  saveUvNet(
    net: SavedUVNetData
  ): void {
    this.#changeUvNets(uvNetSaved(net));
  }

  deleteUvNet(
    id: string
  ): void {
    this.#changeUvNets(uvNetDeleted(id));
  }

  changeDefaultUvNet(
    id: string | null
  ): void {
    this.#changeUvNets(uvNetDefaultChanged(id));
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
    const area = RectArea.from(boundingRect(geometry));
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
      [strokeCommand(pixels, beforeColor)] :
      strokeCommands(pixels, this.buffer.samplePixels(pixels))));
    const stroke = strokeCommand(pixels, color);
    this.#state.apply(stroke);
    this.#commitDrawing({ command: stroke, inverse });
  }

  paintGlobalFill(
    fill: GlobalFill
  ): void {
    const { positions, fromColor, toColor } = fill;
    const stroke = strokeCommand(positions, toColor);

    this.#state.apply(stroke);
    this.#commitDrawing({
      command: stroke,
      inverse: [strokeCommand(positions, fromColor)],
      sent: { action: "global-fill", metadata: { fromColor, toColor } }
    });
  }

  recordStroke(
    pixels: Vec2[],
    color: RGBA8,
    beforeColors: RGBA8[]
  ): void {
    this.#commitDrawing({
      command: strokeCommand(pixels, color),
      inverse: this.#undoable(() => strokeCommands(pixels, beforeColors))
    });
  }

  paintSelectionEdit(
    edit: SelectionEdit
  ): void {
    const { positions } = edit;
    const redo = selectEditCommand(positions, edit.afterColors);

    this.#state.apply(redo);
    this.#commitDrawing({
      command: redo,
      inverse: [selectEditCommand(positions, edit.beforeColors)]
    });
  }

  resize(
    size: Vec2
  ): void {
    const inverse = this.#textureSnapshot();
    const resized: PixelDocumentCommand = {
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

  assignNormalMapZone(
    zone: NormalMapZone
  ): void {
    this.#commitNormalMap(NormalMapChange.assignZone(this.normalMap, zone));
  }

  deleteNormalMapZone(
    regionId: string
  ): void {
    this.#commitNormalMap(NormalMapChange.deleteZone(this.normalMap, regionId));
  }

  applyStep(
    command: PixelDocumentCommand
  ): PixelChange | null {
    return this.#recorder.applyStep(command);
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
    snapshot: PixelDocumentSnapshot
  ): void {
    this.#recorder.load(snapshot);
  }

  runLocalRestore<T>(
    fn: () => T
  ): T {
    return this.#recorder.silently(fn);
  }

  #changeUvNets(
    command: UVNetCommand
  ): void {
    const before = this.uvNets;
    const inverse = this.#state.invert(command);
    this.#state.apply(command);
    if (this.uvNets !== before) {
      this.#recorder.record({ command, inverse });
    }
  }

  readonly #onRegionsChanged = (): void => {
    if (this.#islandFaces === null) {
      this.invalidateIslands();
    }
  };

  #undoable(
    build: () => PixelDocumentCommand[]
  ): PixelDocumentCommand[] {
    return this.#recorder.recording ? build() : [];
  }

  #textureSnapshot(): PixelDocumentCommand[] {
    return this.#undoable(() => [
      textureCommand(this.buffer.size(), this.buffer.pixels())
    ]);
  }

  #commitTexture(
    replace: () => void
  ): void {
    const inverse = this.#textureSnapshot();
    replace();

    this.#recorder.record({
      command: textureCommand(this.buffer.size(), this.buffer.pixels({ copy: false })),
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
