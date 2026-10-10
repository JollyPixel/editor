// Import Internal Dependencies
import type { PixelBuffer } from "../buffer/PixelBuffer.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";
import { groupPositionsByColor } from "../buffer/colorGroups.ts";
import {
  UVMap,
  type UVMapOptions
} from "../uv/map/UVMap.ts";
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
import {
  selectEditOf,
  strokeOf,
  strokesOf,
  textureOf,
  uvRegionCreated,
  uvRegionDeleted,
  uvRegionMoved,
  uvRegionRotated,
  uvRegionStateChanged,
  type DocumentCommand,
  type NormalMapCommand,
  type UVRegionRotation
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
  uv?: Omit<UVMapOptions, "getCanvasSize">;
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
      ...options.uv,
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
        this.uv.restoreMove(id, rect, face);
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

  accepts(
    command: DocumentCommand
  ): boolean {
    switch (command.action) {
      case "uv-region-deleted":
      case "uv-region-moved":
      case "uv-region-rotated":
        return this.uv.get(command.metadata.id) !== undefined;
      case "uv-region-state-changed":
        return this.uv.get(command.metadata.region.id) !== undefined;
      case "normal-map-defaults-patched":
      case "normal-map-zone-set":
      case "normal-map-zone-deleted":
        return NormalMapChange.of(this.#normalMap, command) !== null;
      default:
        return true;
    }
  }

  inverseOf(
    command: DocumentCommand
  ): DocumentCommand[] {
    switch (command.action) {
      case "palette-color-changed": {
        const { index } = command.metadata;

        return [{
          action: "palette-color-changed",
          metadata: { index, color: this.#palette.colorAt(index) }
        }];
      }
      case "stroke":
        return strokesOf(
          command.metadata.positions,
          this.buffer.samplePixels(command.metadata.positions)
        );
      case "global-fill": {
        const { fromColor } = command.metadata;

        return [strokeOf(this.buffer.positionsOf(fromColor), fromColor)];
      }
      case "select-edit":
        return [selectEditOf(
          command.metadata.positions,
          this.buffer.samplePixels(command.metadata.positions)
        )];
      case "resized":
      case "texture-replaced":
        return [textureOf(this.buffer.size(), this.buffer.pixels().slice())];
      case "uv-region-created": {
        const existing = this.uv.get(command.metadata.region.id);

        return [existing ? uvRegionCreated(existing.toJSON()) : uvRegionDeleted(command.metadata.region.id)];
      }
      default:
        return this.#inverseOfExisting(command);
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

  #inverseOfExisting(
    command: DocumentCommand
  ): DocumentCommand[] {
    switch (command.action) {
      case "uv-region-deleted": {
        const region = this.uv.get(command.metadata.id);
        const zone = NormalMapChange.zoneOf(this.#normalMap, command.metadata.id);
        if (region === undefined) {
          return [];
        }

        return zone === null ?
          [uvRegionCreated(region.toJSON())] :
          [uvRegionCreated(region.toJSON()), { action: "normal-map-zone-set", metadata: zone }];
      }
      case "uv-region-moved": {
        const { id, face } = command.metadata;
        const region = this.uv.get(id);

        return region ? [uvRegionMoved(id, face, region.rectFor(face ?? "front"))] : [];
      }
      case "uv-region-state-changed": {
        const region = this.uv.get(command.metadata.region.id);

        return region ? [uvRegionStateChanged(region.toJSON())] : [];
      }
      case "uv-region-rotated": {
        const region = this.uv.get(command.metadata.id);

        return region ? [uvRegionRotated(region, command.metadata.face)] : [];
      }
      case "normal-map-toggled":
      case "normal-map-defaults-patched":
      case "normal-map-zone-set":
      case "normal-map-zone-deleted": {
        const change = NormalMapChange.of(this.#normalMap, command);

        return change === null ? [] : [change.undo];
      }
      default:
        return [];
    }
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
