// Import Internal Dependencies
import {
  NORMAL_MAP_BEVEL_PROFILES,
  NORMAL_MAP_BORDERS,
  NORMAL_MAP_HEIGHTS,
  type NormalMapBevel,
  type NormalMapBorder,
  type NormalMapHeight,
  type NormalMapSettings
} from "./types.ts";
import {
  InvalidNormalMapSettingsError
} from "./errors/InvalidNormalMapSettingsError.ts";

type SettingKey = keyof NormalMapSettings;
type SettingGuards = {
  readonly [TKey in SettingKey]: (
    value: unknown
  ) => value is NormalMapSettings[TKey];
};

// CONSTANTS
const kHeights: ReadonlySet<unknown> = new Set(NORMAL_MAP_HEIGHTS);
const kBorders: ReadonlySet<unknown> = new Set(NORMAL_MAP_BORDERS);
const kProfiles: ReadonlySet<unknown> = new Set(NORMAL_MAP_BEVEL_PROFILES);
const kGuards: SettingGuards = {
  height: (value): value is NormalMapHeight => kHeights.has(value),
  invert: (value): value is boolean => typeof value === "boolean",
  strength: (value): value is number => isNonNegative(value),
  border: (value): value is NormalMapBorder => kBorders.has(value),
  bevel: (value): value is NormalMapBevel => typeof value === "object" &&
    value !== null &&
    "width" in value &&
    "profile" in value &&
    isNonNegative(value.width) &&
    value.width > 0 &&
    kProfiles.has(value.profile),
  edgeIntensity: (value): value is number => isNonNegative(value),
  levels: (value): value is number => Number.isInteger(value) &&
    (value === 0 || (Number(value) >= 3 && Number(value) % 2 === 1))
};
const kKeys: readonly SettingKey[] = Object.keys(kGuards).filter(isSettingKey);

export class NormalMapSettingsPatch {
  readonly values: Readonly<Partial<NormalMapSettings>>;

  static parse(
    value: unknown
  ): NormalMapSettingsPatch | null {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value)
    ) {
      return null;
    }

    const values: Partial<NormalMapSettings> = {};
    for (const key of kKeys) {
      const field: unknown = Reflect.get(value, key);
      if (field === undefined) {
        continue;
      }
      if (!assignField(values, key, field)) {
        return null;
      }
    }

    return new NormalMapSettingsPatch(values);
  }

  static pick(
    settings: Readonly<NormalMapSettings>,
    keys: Iterable<SettingKey>
  ): NormalMapSettingsPatch {
    const values: Partial<NormalMapSettings> = {};
    for (const key of keys) {
      assignField(values, key, settings[key]);
    }

    return new NormalMapSettingsPatch(values);
  }

  constructor(
    values: Readonly<Partial<NormalMapSettings>>
  ) {
    const copied: Partial<NormalMapSettings> = {};
    for (const key of kKeys) {
      const value = values[key];
      if (value !== undefined && !assignField(copied, key, value)) {
        throw new InvalidNormalMapSettingsError(key, value);
      }
    }
    if (copied.bevel) {
      Object.freeze(copied.bevel);
    }
    this.values = Object.freeze(copied);
  }

  get keys(): SettingKey[] {
    return kKeys.filter(
      (key) => this.values[key] !== undefined
    );
  }

  get missingKey(): SettingKey | null {
    return kKeys.find((key) => this.values[key] === undefined) ?? null;
  }

  applyTo(
    settings: Readonly<NormalMapSettings>
  ): Readonly<NormalMapSettings> {
    return Object.freeze({
      ...settings,
      ...this.values,
      bevel: this.values.bevel ?? settings.bevel
    });
  }

  toJSON(): Partial<NormalMapSettings> {
    const values = { ...this.values };
    if (values.bevel) {
      values.bevel = { ...values.bevel };
    }

    return values;
  }
}

function isSettingKey(
  key: string
): key is SettingKey {
  return key in kGuards;
}

function isNonNegative(
  value: unknown
): value is number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0;
}

function assignField<TKey extends SettingKey>(
  target: Partial<NormalMapSettings>,
  key: TKey,
  value: unknown
): boolean {
  if (!kGuards[key](value)) {
    return false;
  }

  target[key] = typeof value === "object"
    ? { ...value }
    : value;

  return true;
}
