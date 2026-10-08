// Import Third-party Dependencies
import {
  KeyedGuard,
  type CommandChange,
  type CommandHistory,
  type HistoryGuard,
  type HistoryKeys,
  type HistoryRegistration,
  type KeyedGuardEntry
} from "@jolly-pixel/history";
import {
  DEFAULT_UV_SLOTS,
  uvTargetKey,
  type DocumentCommand,
  type PixelDocument,
  type UVRegionData,
  type UVSlot,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PixelKeySet,
  type PixelArea
} from "./PixelKeySet.ts";
import { PixelCapture } from "./PixelCapture.ts";
import { pixelEdits } from "./PixelEdits.ts";

// CONSTANTS
const kNormalMapKey = "normal-map";
const kLabels: Readonly<Record<DocumentCommand["action"], string>> = {
  "palette-color-changed": "Change palette color",
  stroke: "Paint",
  "global-fill": "Fill",
  "select-edit": "Edit selection",
  resized: "Resize texture",
  "texture-replaced": "Replace texture",
  "uv-region-created": "Create UV",
  "uv-region-deleted": "Delete UV",
  "uv-region-moved": "Move UV",
  "uv-region-state-changed": "Edit UV",
  "uv-region-rotated": "Rotate UV",
  "normal-map-toggled": "Toggle normal map",
  "normal-map-defaults-patched": "Edit normal map",
  "normal-map-zone-set": "Edit normal map zone",
  "normal-map-zone-deleted": "Delete normal map zone"
};

export interface PixelHistoryRegistrationOptions<TScope extends string> {
  /**
   * @default "pixels"
   */
  id?: string;
  scope: TScope;
}

export function pixelHistoryRegistration<TScope extends string>(
  document: PixelDocument,
  options: PixelHistoryRegistrationOptions<TScope>
): HistoryRegistration<TScope, DocumentCommand, null, PixelKeySet, PixelCapture> {
  const { id = "pixels", scope } = options;

  return {
    id,
    document: pixelEdits(document),
    keys: pixelHistoryKeys(document),
    scopeOf: () => scope,
    label: ({ command }) => kLabels[command.action]
  };
}

export function registerPixelHistory<TScope extends string>(
  history: CommandHistory<TScope>,
  document: PixelDocument,
  options: PixelHistoryRegistrationOptions<TScope>
): () => void {
  const unregister = history.register(pixelHistoryRegistration(document, options));
  const ungroup = document.groupEditsWith(
    (edit) => history.record(options.scope, null, edit)
  );

  return () => {
    ungroup();
    unregister();
  };
}

export function pixelHistoryKeys(
  document: PixelDocument
): HistoryKeys<DocumentCommand, null, PixelKeySet, PixelCapture> {
  return {
    written: (change) => writtenKeys(document, change),
    guard: (commands) => new PixelGuard(document, commands)
  };
}

class PixelGuard implements HistoryGuard<PixelKeySet, PixelCapture> {
  readonly keys: PixelKeySet;

  #document: PixelDocument;
  #named: KeyedGuard;

  constructor(
    document: PixelDocument,
    commands: readonly DocumentCommand[]
  ) {
    const positions: Vec2[] = [];
    const entries: KeyedGuardEntry[] = [];
    let texture = false;
    for (const command of commands) {
      const area = areaOf(command);
      if (area === "texture") {
        texture = true;
      }
      else if (area !== null) {
        positions.push(...area);
      }
      entries.push(...namedEntries(document, command));
    }

    this.#document = document;
    this.#named = new KeyedGuard(entries);
    this.keys = new PixelKeySet(
      texture ? "texture" : positions,
      this.#named.keys
    );
  }

  touches(
    written: PixelKeySet
  ): boolean {
    return this.keys.overlaps(written);
  }

  capture(): PixelCapture {
    return new PixelCapture(
      this.#document.size(),
      this.#pixels(),
      this.#named.capture()
    );
  }

  same(
    captured: PixelCapture
  ): boolean {
    const size = this.#document.size();

    return captured.size.x === size.x &&
      captured.size.y === size.y &&
      sameBytes(captured.pixels, this.#pixels()) &&
      this.#named.same(captured.named);
  }

  #pixels(): Uint8ClampedArray {
    const source = this.#document.buffer.pixels({
      copy: false
    });
    if (this.keys.texture) {
      return source.slice();
    }

    const { x: width, y: height } = this.#document.size();
    const pixels = new Uint8ClampedArray(
      this.keys.pixelCount * 4
    );
    let offset = 0;
    for (const { x, y } of this.keys.positions()) {
      if (x < width && y < height) {
        pixels.set(
          source.subarray(((y * width) + x) * 4, (((y * width) + x) * 4) + 4), offset
        );
      }
      offset += 4;
    }

    return pixels.subarray(0, offset);
  }
}

function writtenKeys(
  document: PixelDocument,
  change: CommandChange<DocumentCommand, null>
): PixelKeySet {
  return new PixelKeySet(
    areaOf(change.command),
    namedEntries(document, change.command).map(({ key }) => key)
  );
}

function areaOf(
  command: DocumentCommand
): PixelArea | null {
  switch (command.action) {
    case "stroke":
    case "select-edit":
      return command.metadata.positions;
    case "global-fill":
    case "resized":
    case "texture-replaced":
      return "texture";
    default:
      return null;
  }
}

function namedEntries(
  document: PixelDocument,
  command: DocumentCommand
): KeyedGuardEntry[] {
  switch (command.action) {
    case "palette-color-changed": {
      const { index } = command.metadata;

      return [{ key: `palette:${index}`, read: () => document.palette.colorAt(index) }];
    }
    case "uv-region-created":
    case "uv-region-state-changed":
      return regionEntries(document, command.metadata.region);
    case "uv-region-deleted":
      return regionEntries(document, { id: command.metadata.id });
    case "uv-region-moved":
      return [slotEntry(document, command.metadata.id, command.metadata.face)];
    case "uv-region-rotated": {
      const rotation = command.metadata;

      return rotation.face === null ?
        regionEntries(document, rotation.region) :
        [slotEntry(document, rotation.id, rotation.face)];
    }
    case "normal-map-toggled":
      return [{ key: kNormalMapKey, read: () => document.normalMap?.toJSON() ?? null }];
    case "normal-map-defaults-patched":
      return Object.keys(command.metadata.patch).map((field) => {
        return {
          key: `normal-map:defaults:${field}`,
          read: () => Reflect.get(document.normalMap?.defaults ?? {}, field)
        };
      });
    case "normal-map-zone-set":
      return [zoneEntry(document, command.metadata.zone.regionId)];
    case "normal-map-zone-deleted":
      return [zoneEntry(document, command.metadata.regionId)];
    default:
      return [];
  }
}

function regionEntries(
  document: PixelDocument,
  region: Pick<UVRegionData, "id" | "faces">
): KeyedGuardEntry[] {
  const slots = region.faces ? Object.keys(region.faces) as UVSlot[] : DEFAULT_UV_SLOTS;

  return [
    slotEntry(document, region.id, null),
    ...slots.map((slot) => slotEntry(document, region.id, slot))
  ];
}

function slotEntry(
  document: PixelDocument,
  regionId: string,
  slot: UVSlot | null
): KeyedGuardEntry {
  return {
    key: uvTargetKey({ regionId, slot }),
    read: () => {
      const region = document.uv.get(regionId);
      if (region === undefined) {
        return undefined;
      }
      if (slot === null) {
        return region.toJSON();
      }

      return region.slots.includes(slot)
        ? region.geometryFor(slot)
        : undefined;
    }
  };
}

function zoneEntry(
  document: PixelDocument,
  regionId: string
): KeyedGuardEntry {
  return {
    key: `normal-map:zone:${regionId}`,
    read: () => document.normalMap?.zones.find((zone) => zone.regionId === regionId)
  };
}

function sameBytes(
  left: Uint8ClampedArray,
  right: Uint8ClampedArray
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}
