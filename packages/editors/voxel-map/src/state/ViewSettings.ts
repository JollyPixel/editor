// CONSTANTS
const kLightingModes = ["flat", "studio", "daylight"] as const;

export type LightingMode = typeof kLightingModes[number];

export interface ViewSettingsJSON {
  lighting: LightingMode;
  reflections: boolean;
  ambientOcclusion: boolean;
  shadows: boolean;
}

export class ViewSettings implements ViewSettingsJSON {
  static readonly DEFAULT = new ViewSettings({
    lighting: "studio",
    reflections: false,
    ambientOcclusion: false,
    shadows: false
  });

  static parse(
    raw: string | null
  ): ViewSettings {
    if (raw === null) {
      return ViewSettings.DEFAULT;
    }

    try {
      return ViewSettings.DEFAULT.#merged(
        JSON.parse(raw)
      );
    }
    catch {
      return ViewSettings.DEFAULT;
    }
  }

  readonly lighting: LightingMode;
  readonly reflections: boolean;
  readonly ambientOcclusion: boolean;
  readonly shadows: boolean;

  constructor(
    settings: ViewSettingsJSON
  ) {
    this.lighting = settings.lighting;
    this.reflections = settings.reflections;
    this.ambientOcclusion = settings.ambientOcclusion;
    this.shadows = settings.shadows;

    Object.freeze(this);
  }

  with(
    patch: Partial<ViewSettingsJSON>
  ): ViewSettings {
    return this.#merged(patch);
  }

  equals(
    other: ViewSettings
  ): boolean {
    return this.lighting === other.lighting &&
      this.reflections === other.reflections &&
      this.ambientOcclusion === other.ambientOcclusion &&
      this.shadows === other.shadows;
  }

  toJSON(): ViewSettingsJSON {
    return {
      lighting: this.lighting,
      reflections: this.reflections,
      ambientOcclusion: this.ambientOcclusion,
      shadows: this.shadows
    };
  }

  #merged(
    value: unknown
  ): ViewSettings {
    const fields: Map<string, unknown> = typeof value === "object" &&
      value !== null ?
      new Map(Object.entries(value)) :
      new Map();
    const lighting = fields.get("lighting");

    return new ViewSettings({
      lighting: kLightingModes.find((mode) => mode === lighting) ??
        this.lighting,
      reflections: booleanOr(fields.get("reflections"), this.reflections),
      ambientOcclusion: booleanOr(
        fields.get("ambientOcclusion"),
        this.ambientOcclusion
      ),
      shadows: booleanOr(fields.get("shadows"), this.shadows)
    });
  }
}

function booleanOr(
  value: unknown,
  fallback: boolean
): boolean {
  return typeof value === "boolean" ? value : fallback;
}
