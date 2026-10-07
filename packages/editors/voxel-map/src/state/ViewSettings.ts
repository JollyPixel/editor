// CONSTANTS
const kLightingModes = ["flat", "studio", "daylight", "night"] as const;

export type LightingMode = typeof kLightingModes[number];

export interface ViewSettingsJSON {
  lighting: LightingMode;
  reflections: boolean;
  ambientOcclusion: boolean;
  shadows: boolean;
  blockLight: boolean;
  glow: boolean;
}

export class ViewSettings implements ViewSettingsJSON {
  static readonly DEFAULT = new ViewSettings({
    lighting: "studio",
    reflections: false,
    ambientOcclusion: false,
    shadows: false,
    blockLight: true,
    glow: true
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
  readonly blockLight: boolean;
  readonly glow: boolean;

  constructor(
    settings: ViewSettingsJSON
  ) {
    this.lighting = settings.lighting;
    this.reflections = settings.reflections;
    this.ambientOcclusion = settings.ambientOcclusion;
    this.shadows = settings.shadows;
    this.blockLight = settings.blockLight;
    this.glow = settings.glow;

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
      this.shadows === other.shadows &&
      this.blockLight === other.blockLight &&
      this.glow === other.glow;
  }

  toJSON(): ViewSettingsJSON {
    return {
      lighting: this.lighting,
      reflections: this.reflections,
      ambientOcclusion: this.ambientOcclusion,
      shadows: this.shadows,
      blockLight: this.blockLight,
      glow: this.glow
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
      shadows: booleanOr(fields.get("shadows"), this.shadows),
      blockLight: booleanOr(fields.get("blockLight"), this.blockLight),
      glow: booleanOr(fields.get("glow"), this.glow)
    });
  }
}

function booleanOr(
  value: unknown,
  fallback: boolean
): boolean {
  return typeof value === "boolean" ? value : fallback;
}
