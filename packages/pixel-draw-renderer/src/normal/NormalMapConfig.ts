// Import Internal Dependencies
import { NormalMapSettingsPatch } from "./NormalMapSettingsPatch.ts";
import type {
  NormalMapData,
  NormalMapSettings,
  NormalMapZone,
  ResolvedNormalMapSettings
} from "./types.ts";

// CONSTANTS
export const DEFAULT_NORMAL_MAP_SETTINGS: Readonly<NormalMapSettings> = Object.freeze({
  height: "luminance",
  invert: false,
  strength: 2,
  border: "wrap",
  bevel: Object.freeze({
    width: 1,
    profile: "round"
  }),
  edgeIntensity: 1,
  levels: 0
});

export class NormalMapConfig {
  readonly defaults: Readonly<NormalMapSettings>;
  readonly zones: readonly Readonly<NormalMapZone>[];

  static create(
    defaults: Partial<NormalMapSettings> = {}
  ): NormalMapConfig {
    return new NormalMapConfig(
      new NormalMapSettingsPatch(defaults)
        .applyTo(DEFAULT_NORMAL_MAP_SETTINGS),
      []
    );
  }

  static from(
    data: NormalMapData
  ): NormalMapConfig {
    return new NormalMapConfig(data.defaults, data.zones);
  }

  static parse(
    value: unknown
  ): NormalMapConfig | null {
    if (
      typeof value !== "object" ||
      value === null ||
      !("defaults" in value) ||
      !("zones" in value) ||
      !Array.isArray(value.zones)
    ) {
      return null;
    }

    const defaults = NormalMapSettingsPatch.parse(
      value.defaults
    );
    if (
      defaults === null ||
      !defaults.isComplete
    ) {
      return null;
    }

    const zones: NormalMapZone[] = [];
    for (const item of value.zones) {
      const zone = NormalMapConfig.#parseZone(item);
      if (
        zone === null ||
        zones.some((other) => other.regionId === zone.regionId)
      ) {
        return null;
      }
      zones.push(zone);
    }

    return new NormalMapConfig(
      defaults.applyTo(DEFAULT_NORMAL_MAP_SETTINGS),
      zones
    );
  }

  static #parseZone(
    value: unknown
  ): NormalMapZone | null {
    if (
      typeof value !== "object" ||
      value === null ||
      !("regionId" in value) ||
      !("settings" in value) ||
      typeof value.regionId !== "string" ||
      value.regionId.length === 0
    ) {
      return null;
    }
    if (value.settings === "off") {
      return {
        regionId: value.regionId,
        settings: "off"
      };
    }

    const patch = NormalMapSettingsPatch.parse(
      value.settings
    );

    return patch === null ?
      null :
      {
        regionId: value.regionId,
        settings: patch.values
      };
  }

  static #freezeZone(
    zone: Readonly<NormalMapZone>
  ): Readonly<NormalMapZone> {
    return Object.freeze({
      regionId: zone.regionId,
      settings: zone.settings === "off" ?
        "off" :
        new NormalMapSettingsPatch(zone.settings).values
    });
  }

  constructor(
    defaults: Readonly<NormalMapSettings>,
    zones: readonly Readonly<NormalMapZone>[]
  ) {
    this.defaults = Object.freeze({
      ...defaults,
      bevel: Object.freeze({ ...defaults.bevel })
    });
    this.zones = Object.freeze(
      zones.map(NormalMapConfig.#freezeZone)
    );
  }

  zoneOf(
    regionId: string
  ): Readonly<NormalMapZone> | undefined {
    return this.zones.find(
      (zone) => zone.regionId === regionId
    );
  }

  indexOf(
    regionId: string
  ): number {
    return this.zones.findIndex(
      (zone) => zone.regionId === regionId
    );
  }

  pickDefaults(
    keys: Iterable<keyof NormalMapSettings>
  ): Partial<NormalMapSettings> {
    return NormalMapSettingsPatch.pick(
      this.defaults,
      keys
    ).toJSON();
  }

  withDefaults(
    patch: Partial<NormalMapSettings>
  ): NormalMapConfig {
    return new NormalMapConfig(
      new NormalMapSettingsPatch(patch)
        .applyTo(this.defaults),
      this.zones
    );
  }

  withZone(
    zone: NormalMapZone,
    index?: number
  ): NormalMapConfig {
    const zones = [...this.zones];
    const existing = this.indexOf(zone.regionId);
    if (existing === -1) {
      const at = index === undefined ?
        zones.length :
        Math.min(Math.max(0, index), zones.length);
      zones.splice(at, 0, zone);
    }
    else {
      zones[existing] = zone;
    }

    return new NormalMapConfig(
      this.defaults,
      zones
    );
  }

  withoutZone(
    regionId: string
  ): NormalMapConfig {
    if (this.indexOf(regionId) === -1) {
      return this;
    }

    return new NormalMapConfig(
      this.defaults,
      this.zones.filter((zone) => zone.regionId !== regionId)
    );
  }

  resolve(
    regionIds: Iterable<string>
  ): ResolvedNormalMapSettings {
    const zone = this.winningZone(regionIds);
    if (zone === undefined) {
      return this.defaults;
    }

    return zone.settings === "off" ?
      "off" :
      new NormalMapSettingsPatch(zone.settings)
        .applyTo(this.defaults);
  }

  winningZone(
    regionIds: Iterable<string>
  ): Readonly<NormalMapZone> | undefined {
    const ids = regionIds instanceof Set
      ? regionIds
      : new Set(regionIds);

    return this.zones.findLast(
      (zone) => ids.has(zone.regionId)
    );
  }

  toJSON(): NormalMapData {
    return {
      defaults: {
        ...this.defaults,
        bevel: { ...this.defaults.bevel }
      },
      zones: this.zones.map((zone) => {
        return {
          regionId: zone.regionId,
          settings: zone.settings === "off" ?
            "off" :
            new NormalMapSettingsPatch(zone.settings).toJSON()
        };
      })
    };
  }
}
