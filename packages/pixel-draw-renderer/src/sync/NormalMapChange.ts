// Import Internal Dependencies
import type { NormalMapCommand } from "./PixelCommand.ts";
import type { NormalMapConfig } from "../normal/NormalMapConfig.ts";
import type {
  IndexedNormalMapZone,
  NormalMapSettings,
  NormalMapZone
} from "../normal/types.ts";

export class NormalMapChange {
  static toggle(
    current: NormalMapConfig | null,
    config: NormalMapConfig | null
  ): NormalMapChange | null {
    if (current === null && config === null) {
      return null;
    }

    return new NormalMapChange(
      {
        action: "normal-map-toggled",
        metadata: { config: config?.toJSON() ?? null }
      },
      {
        action: "normal-map-toggled",
        metadata: { config: current?.toJSON() ?? null }
      }
    );
  }

  static patchDefaults(
    current: NormalMapConfig | null,
    patch: Partial<NormalMapSettings>
  ): NormalMapChange | null {
    if (current === null) {
      return null;
    }

    const next = current.withDefaults(patch);
    const keys = Object.keys(patch).filter(
      (key): key is keyof NormalMapSettings => key in next.defaults
    );

    return new NormalMapChange(
      {
        action: "normal-map-defaults-patched",
        metadata: { patch: next.pickDefaults(keys) }
      },
      {
        action: "normal-map-defaults-patched",
        metadata: { patch: current.pickDefaults(keys) }
      }
    );
  }

  static setZone(
    current: NormalMapConfig | null,
    zone: NormalMapZone
  ): NormalMapChange | null {
    if (current === null) {
      return null;
    }

    const next = current.withZone(zone);
    const index = next.indexOf(zone.regionId);
    const existing = NormalMapChange.zoneOf(current, zone.regionId);

    return new NormalMapChange(
      {
        action: "normal-map-zone-set",
        metadata: {
          zone: structuredClone(next.zones[index]),
          index
        }
      },
      existing ?
        {
          action: "normal-map-zone-set",
          metadata: existing
        } :
        {
          action: "normal-map-zone-deleted",
          metadata: { regionId: zone.regionId }
        }
    );
  }

  static deleteZone(
    current: NormalMapConfig | null,
    regionId: string
  ): NormalMapChange | null {
    const deleted = NormalMapChange.zoneOf(current, regionId);
    if (deleted === null) {
      return null;
    }

    return new NormalMapChange(
      {
        action: "normal-map-zone-deleted",
        metadata: { regionId }
      },
      {
        action: "normal-map-zone-set",
        metadata: deleted
      }
    );
  }

  static zoneOf(
    config: NormalMapConfig | null,
    regionId: string
  ): IndexedNormalMapZone | null {
    const index = config?.indexOf(regionId) ?? -1;
    if (config === null || index === -1) {
      return null;
    }

    return {
      zone: structuredClone(config.zones[index]),
      index
    };
  }

  readonly redo: NormalMapCommand;
  readonly undo: NormalMapCommand;

  constructor(
    redo: NormalMapCommand,
    undo: NormalMapCommand
  ) {
    this.redo = redo;
    this.undo = undo;
  }
}
