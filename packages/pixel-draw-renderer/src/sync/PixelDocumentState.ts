// Import Internal Dependencies
import type { PixelBuffer } from "../buffer/PixelBuffer.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";
import { groupPositionsByColor } from "../buffer/colorGroups.ts";
import { UVMap } from "../uv/map/UVMap.ts";
import type {
  UVRegion,
  UVRegionData
} from "../uv/region/UVRegion.ts";
import { NormalMapConfig } from "../normal/NormalMapConfig.ts";
import { ColorPalette } from "../palette/ColorPalette.ts";
import type {
  IndexedNormalMapZone,
  NormalMapData
} from "../normal/types.ts";
import type {
  RGBA8,
  Vec2
} from "../types.ts";
import type {
  DocumentCommand,
  NormalMapCommand,
  UVRegionRotation
} from "./PixelCommand.ts";
import { NormalMapChange } from "./NormalMapChange.ts";
import {
  applyNormalMapCommand,
  normalMapRegionIds
} from "./normalMapCommands.ts";

export type NormalMapChangedListener = (regionIds: string[] | null) => void;

export interface PixelDocumentSnapshot {
  size: Vec2;
  pixels: Uint8ClampedArray;
  uvRegions?: Iterable<UVRegion | UVRegionData>;
  normalMap?: NormalMapData | null;
  palette?: readonly RGBA8[];
}

export interface PixelDocumentStateOptions<
  TBuffer extends DefaultPixelBuffer
> {
  buffer: TBuffer;
  onNormalMapChanged?: NormalMapChangedListener;
  onPaletteChanged?: (index: number | null) => void;
}

export class PixelDocumentState<
  TBuffer extends DefaultPixelBuffer = PixelBuffer
> {
  readonly buffer: TBuffer;
  readonly uv: UVMap;

  #normalMap: NormalMapConfig | null = null;
  #palette = ColorPalette.create();
  #onPaletteChanged?: (index: number | null) => void;
  #onNormalMapChanged?: NormalMapChangedListener;

  constructor(
    options: PixelDocumentStateOptions<TBuffer>
  ) {
    this.buffer = options.buffer;
    this.uv = new UVMap({
      getCanvasSize: () => this.buffer.size()
    });
    this.#onNormalMapChanged = options.onNormalMapChanged;
    this.#onPaletteChanged = options.onPaletteChanged;
  }

  get normalMap(): NormalMapConfig | null {
    return this.#normalMap;
  }

  get palette(): ColorPalette {
    return this.#palette;
  }

  apply(
    command: DocumentCommand
  ): void {
    switch (command.action) {
      case "palette-color-changed": {
        const { index, color } = command.metadata;
        const palette = this.#palette.withColor(index, color);
        if (palette !== this.#palette) {
          this.#palette = palette;
          this.#onPaletteChanged?.(index);
        }
        break;
      }
      case "stroke":
        this.#paint(command.metadata.positions, command.metadata.color);
        break;
      case "global-fill":
        this.#paint(
          this.buffer.positionsOf(command.metadata.fromColor),
          command.metadata.toColor
        );
        break;
      case "select-edit":
        this.#paintEach(command.metadata.positions, command.metadata.colors);
        break;
      case "resized":
        this.buffer.resize(command.metadata.size);
        break;
      case "texture-replaced":
        this.buffer.replacePixels(command.metadata.pixels, command.metadata.size);
        break;
      case "uv-region-created":
        this.uv.restore(command.metadata.region);
        break;
      case "uv-region-deleted":
        this.uv.delete(command.metadata.id);
        this.removeNormalMapZoneOf(command.metadata.id);
        break;
      case "uv-region-moved": {
        const { id, rect, face } = command.metadata;
        this.uv.move(id, rect, face);
        break;
      }
      case "uv-region-state-changed":
        this.uv.restoreState(command.metadata.region);
        break;
      case "uv-region-rotated":
        this.#rotate(command.metadata);
        break;
      case "normal-map-toggled":
      case "normal-map-defaults-patched":
      case "normal-map-zone-set":
      case "normal-map-zone-deleted":
        this.#applyNormalMap(command);
        break;
      default:
        assertNever(command);
    }
  }

  load(
    snapshot: PixelDocumentSnapshot,
    owns: (regionId: string) => boolean = () => true
  ): void {
    const palette = snapshot.palette === undefined ?
      ColorPalette.create() : ColorPalette.from(snapshot.palette);
    this.#replaceNormalMap(
      snapshot.normalMap ? NormalMapConfig.from(snapshot.normalMap) : null,
      null
    );
    this.#palette = palette;
    this.#onPaletteChanged?.(null);
    this.buffer.replacePixels(snapshot.pixels, snapshot.size);
    this.uv.clear((region) => owns(region.id));
    for (const region of snapshot.uvRegions ?? []) {
      if (owns(region.id)) {
        this.uv.restore(region);
      }
    }
  }

  removeNormalMapZoneOf(
    regionId: string
  ): IndexedNormalMapZone | null {
    const removed = NormalMapChange.zoneOf(this.#normalMap, regionId);
    this.#applyNormalMap({
      action: "normal-map-zone-deleted",
      metadata: { regionId }
    });

    return removed;
  }

  #paint(
    positions: Vec2[],
    color: RGBA8
  ): void {
    this.buffer.drawPixels(positions, color);
    this.buffer.copyToMaster();
  }

  #paintEach(
    positions: Vec2[],
    colors: RGBA8[]
  ): void {
    this.buffer.drawColorGroups(groupPositionsByColor(positions, colors));
    this.buffer.copyToMaster();
  }

  #rotate(
    rotation: UVRegionRotation
  ): void {
    if (rotation.face === null) {
      this.uv.restoreRotation(rotation.region);

      return;
    }

    const region = this.uv.get(rotation.id);
    if (region) {
      this.uv.restoreRotation(
        region.withGeometry(rotation.face, rotation.geometry),
        rotation.face
      );
    }
  }

  #applyNormalMap(
    command: NormalMapCommand
  ): void {
    this.#replaceNormalMap(
      applyNormalMapCommand(this.#normalMap, command),
      normalMapRegionIds(command)
    );
  }

  #replaceNormalMap(
    config: NormalMapConfig | null,
    regionIds: string[] | null
  ): void {
    if (config === this.#normalMap) {
      return;
    }

    this.#normalMap = config;
    this.#onNormalMapChanged?.(regionIds);
  }
}

function assertNever(
  command: never
): never {
  throw new TypeError(`Unknown pixel command: ${JSON.stringify(command)}`);
}
