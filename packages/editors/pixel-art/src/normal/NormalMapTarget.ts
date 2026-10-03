// Import Third-party Dependencies
import type {
  NormalMap,
  NormalMapConfig,
  NormalMapSettings,
  NormalMapZone
} from "@jolly-pixel/pixel-draw.renderer";

export interface NormalMapTargetDocument {
  readonly normalMap: NormalMapConfig | null;
  readonly normals: NormalMap;
  readonly uv: {
    readonly selectedRegionId: string | null;
  };
  patchNormalMapDefaults(
    patch: Partial<NormalMapSettings>
  ): void;
  setNormalMapZone(
    zone: NormalMapZone
  ): void;
}

export class NormalMapTarget {
  static of(
    doc: NormalMapTargetDocument
  ): NormalMapTarget | null {
    const committed = doc.normalMap;
    if (committed === null) {
      return null;
    }

    const regionId = doc.uv.selectedRegionId;
    const zone = regionId === null ? undefined : committed.zoneOf(regionId);

    return new NormalMapTarget(doc, committed, zone ?? null);
  }

  readonly zone: Readonly<NormalMapZone> | null;

  readonly #doc: NormalMapTargetDocument;
  readonly #committed: NormalMapConfig;

  constructor(
    doc: NormalMapTargetDocument,
    committed: NormalMapConfig,
    zone: Readonly<NormalMapZone> | null
  ) {
    this.#doc = doc;
    this.#committed = committed;
    this.zone = zone;
  }

  get off(): boolean {
    return this.zone?.settings === "off";
  }

  get settings(): Readonly<NormalMapSettings> {
    const shown = this.#shown;
    if (this.zone === null) {
      return shown.defaults;
    }

    const resolved = shown.resolve([this.zone.regionId]);

    return resolved === "off" ? shown.defaults : resolved;
  }

  overrides(
    key: keyof NormalMapSettings
  ): boolean {
    const zone = this.zone === null ?
      undefined :
      this.#shown.zoneOf(this.zone.regionId);

    return zone !== undefined &&
      zone.settings !== "off" &&
      Object.hasOwn(zone.settings, key);
  }

  write(
    patch: Partial<NormalMapSettings>,
    last: boolean
  ): void {
    const zone = this.#patchedZone(patch);
    if (!last) {
      this.#doc.normals.preview(zone === null ?
        this.#committed.withDefaults(patch) :
        this.#committed.withZone(zone));

      return;
    }

    this.#doc.normals.preview(null);
    if (zone === null) {
      this.#doc.patchNormalMapDefaults(patch);
    }
    else {
      this.#doc.setNormalMapZone(zone);
    }
  }

  switchOff(
    off: boolean
  ): void {
    if (this.zone !== null) {
      this.#doc.setNormalMapZone({
        regionId: this.zone.regionId,
        settings: off ? "off" : {}
      });
    }
  }

  reset(
    key: keyof NormalMapSettings
  ): void {
    if (this.zone === null || this.zone.settings === "off") {
      return;
    }

    const settings = { ...this.zone.settings };
    delete settings[key];
    this.#doc.setNormalMapZone({
      regionId: this.zone.regionId,
      settings
    });
  }

  get #shown(): NormalMapConfig {
    return this.#doc.normals.config ?? this.#committed;
  }

  #patchedZone(
    patch: Partial<NormalMapSettings>
  ): NormalMapZone | null {
    if (this.zone === null) {
      return null;
    }

    return {
      regionId: this.zone.regionId,
      settings: {
        ...(this.zone.settings === "off" ? {} : this.zone.settings),
        ...patch
      }
    };
  }
}
