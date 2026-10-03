// Import Internal Dependencies
import type { NormalMapCommand } from "../buffer/hooks.ts";
import type { HistoryNormalMapEntry } from "../history/HistoryStack.types.ts";
import { NormalMapConfig } from "../normal/NormalMapConfig.ts";
import type {
  IndexedNormalMapZone,
  NormalMapData,
  NormalMapSettings,
  NormalMapZone
} from "../normal/types.ts";
import { applyNormalMapCommand } from "./normalMapCommands.ts";

export type NormalMapChange = Omit<HistoryNormalMapEntry, "timestamp">;

export type NormalMapChangedListener = (regionIds: string[] | null) => void;

export class NormalMapEdits {
  #config: NormalMapConfig | null = null;
  #onChanged: NormalMapChangedListener;

  constructor(
    onChanged: NormalMapChangedListener
  ) {
    this.#onChanged = onChanged;
  }

  get config(): NormalMapConfig | null {
    return this.#config;
  }

  toggle(
    config: NormalMapConfig | null
  ): NormalMapChange | null {
    if (this.#config === null && config === null) {
      return null;
    }

    return change(
      {
        action: "normal-map-toggled",
        metadata: { config: config?.toJSON() ?? null }
      },
      {
        action: "normal-map-toggled",
        metadata: { config: this.#config?.toJSON() ?? null }
      }
    );
  }

  patchDefaults(
    patch: Partial<NormalMapSettings>
  ): NormalMapChange | null {
    if (this.#config === null) {
      return null;
    }

    const next = this.#config.withDefaults(patch);
    const keys = Object.keys(patch).filter(
      (key): key is keyof NormalMapSettings => key in next.defaults
    );

    return change(
      {
        action: "normal-map-defaults-patched",
        metadata: { patch: next.pickDefaults(keys) }
      },
      {
        action: "normal-map-defaults-patched",
        metadata: { patch: this.#config.pickDefaults(keys) }
      }
    );
  }

  setZone(
    zone: NormalMapZone
  ): NormalMapChange | null {
    if (this.#config === null) {
      return null;
    }

    const next = this.#config.withZone(zone);
    const index = next.indexOf(zone.regionId);
    const existing = this.#indexedZoneOf(zone.regionId);

    return change(
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

  deleteZone(
    regionId: string
  ): NormalMapChange | null {
    const deleted = this.#indexedZoneOf(regionId);
    if (deleted === null) {
      return null;
    }

    return change(
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

  apply(
    command: NormalMapCommand
  ): void {
    this.#replace(
      applyNormalMapCommand(this.#config, command),
      changedRegionIds(command)
    );
  }

  load(
    data: NormalMapData | null
  ): void {
    this.#replace(
      data === null ? null : NormalMapConfig.from(data),
      null
    );
  }

  removeZoneOf(
    regionId: string
  ): IndexedNormalMapZone | null {
    const removed = this.#indexedZoneOf(regionId);
    this.apply({
      action: "normal-map-zone-deleted",
      metadata: { regionId }
    });

    return removed;
  }

  #indexedZoneOf(
    regionId: string
  ): IndexedNormalMapZone | null {
    const config = this.#config;
    const index = config?.indexOf(regionId) ?? -1;
    if (config === null || index === -1) {
      return null;
    }

    return {
      zone: structuredClone(config.zones[index]),
      index
    };
  }

  #replace(
    config: NormalMapConfig | null,
    regionIds: string[] | null
  ): void {
    if (config === this.#config) {
      return;
    }

    this.#config = config;
    this.#onChanged(regionIds);
  }
}

function change(
  redo: NormalMapCommand,
  undo: NormalMapCommand
): NormalMapChange {
  return {
    action: "normal-map",
    redo,
    undo
  };
}

function changedRegionIds(
  command: NormalMapCommand
): string[] | null {
  switch (command.action) {
    case "normal-map-zone-set":
      return [command.metadata.zone.regionId];
    case "normal-map-zone-deleted":
      return [command.metadata.regionId];
    default:
      return null;
  }
}
