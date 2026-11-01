// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  CHORDS_SCHEMA,
  preferenceFieldSchema,
  preferenceValueSchema,
  samePreferenceValue,
  type BindingPreference,
  type FormPreference,
  type PreferenceField,
  type PreferenceValue
} from "./PreferenceField.ts";
import { ChordConflictError } from "./errors/ChordConflictError.ts";
import { InvalidPreferencesError } from "./errors/InvalidPreferencesError.ts";

// CONSTANTS
export const PREFERENCE_SCOPE_NAME = /^[a-z0-9][a-z0-9-]*$/;
const kScopeDescriptorSchema = z.object({
  name: z.string().check(z.regex(PREFERENCE_SCOPE_NAME)),
  label: z.string().check(z.minLength(1), z.maxLength(80)),
  fields: z.record(z.string(), preferenceFieldSchema)
});

export type PreferenceFields = Readonly<Record<string, PreferenceField>>;

export type PreferenceOverrides = Readonly<Record<string, unknown>>;

export type PreferenceValues<TFields extends PreferenceFields> = {
  readonly [TKey in keyof TFields]: PreferenceValue<TFields[TKey]>;
};

interface EnumShape<TValue extends string> {
  readonly type: "enum";
  readonly options: readonly { readonly value: TValue; }[];
}

type EnumDefaults<TFields extends PreferenceFields> = {
  readonly [TKey in keyof TFields]: TFields[TKey] extends EnumShape<infer TValue> ?
    { readonly default: TValue; } :
    unknown;
};

export interface PreferenceFieldGroup<
  TField extends PreferenceField = PreferenceField
> {
  label: string | null;
  fields: Array<[key: string, field: TField]>;
}

export interface PreferenceScopeDefinition<
  TFields extends PreferenceFields
> {
  /**
   * Kebab-case key the overrides are stored under.
   */
  name: string;
  /**
   * Title of the scope's Settings page.
   */
  label: string;
  fields: TFields;
}

export class PreferenceScope<
  TFields extends PreferenceFields = PreferenceFields
> {
  static from(
    descriptor: unknown
  ): PreferenceScope {
    return new PreferenceScope(
      kScopeDescriptorSchema.parse(descriptor)
    );
  }

  readonly name: string;
  readonly label: string;
  readonly fields: TFields;
  readonly form: readonly PreferenceFieldGroup<FormPreference>[];
  readonly keyBindings: readonly PreferenceFieldGroup<BindingPreference>[];

  #schemas = new Map<string, z.ZodMiniType<unknown>>();

  constructor(
    definition: PreferenceScopeDefinition<TFields>
  ) {
    const { name } = definition;
    if (!PREFERENCE_SCOPE_NAME.test(name)) {
      throw new InvalidPreferencesError(name, "the scope name is not kebab-case");
    }

    this.name = name;
    this.label = definition.label;
    this.fields = definition.fields;
    const form: Array<[string, FormPreference]> = [];
    const keyBindings: Array<[string, BindingPreference]> = [];
    for (const [key, field] of Object.entries(definition.fields)) {
      if (field.type === "range" && field.min > field.max) {
        throw new InvalidPreferencesError(name, `"${key}" has min above max`);
      }

      const schema = preferenceValueSchema(field);
      if (!schema.safeParse(field.default).success) {
        throw new InvalidPreferencesError(name, `"${key}" refuses its default`);
      }
      this.#schemas.set(key, schema);
      if (field.type === "chord" || field.type === "key") {
        keyBindings.push([key, field]);
      }
      else {
        form.push([key, field]);
      }
    }
    this.form = groupFields(form);
    this.keyBindings = groupFields(keyBindings);
    this.#checkChords({}, []);
  }

  get defaults(): PreferenceValues<TFields> {
    return this.resolve({});
  }

  has(
    key: string
  ): key is keyof TFields & string {
    return this.#schemas.has(key);
  }

  resolve(
    overrides: PreferenceOverrides
  ): PreferenceValues<TFields> {
    const values: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(this.fields)) {
      values[key] = field.default;
    }

    return Object.freeze(
      Object.assign(values, this.prune(overrides))
    ) as PreferenceValues<TFields>;
  }

  prune(
    input: unknown
  ): PreferenceOverrides {
    const overrides: Record<string, unknown> = {};
    if (!isRecord(input)) {
      return overrides;
    }

    for (const [key, schema] of this.#schemas) {
      if (!Object.hasOwn(input, key)) {
        continue;
      }

      const result = schema.safeParse(input[key]);
      if (result.success && !this.#isDefault(key, result.data)) {
        overrides[key] = result.data;
      }
    }

    return overrides;
  }

  parse(
    input: unknown
  ): PreferenceOverrides {
    if (!isRecord(input)) {
      throw new InvalidPreferencesError(this.name, "overrides must be an object");
    }

    return this.update({}, input);
  }

  update(
    overrides: PreferenceOverrides,
    patch: PreferenceOverrides
  ): PreferenceOverrides {
    const next: Record<string, unknown> = { ...overrides };
    for (const [key, value] of Object.entries(patch)) {
      const accepted = this.#accept(key, value);
      if (this.#isDefault(key, accepted)) {
        delete next[key];
      }
      else {
        next[key] = accepted;
      }
    }
    this.#checkChords(next, Object.keys(patch));

    return next;
  }

  bindings(
    overrides: PreferenceOverrides
  ): Map<string, readonly string[]> {
    const bindings = new Map<string, readonly string[]>();
    for (const group of this.keyBindings) {
      for (const [key, field] of group.fields) {
        const stored = CHORDS_SCHEMA.safeParse(overrides[key]);
        bindings.set(key, stored.success ? stored.data : field.default);
      }
    }

    return bindings;
  }

  toJSON(): PreferenceScopeDefinition<TFields> {
    return {
      name: this.name,
      label: this.label,
      fields: this.fields
    };
  }

  #accept(
    key: string,
    value: unknown
  ): unknown {
    const schema = this.#schemas.get(key);
    if (schema === undefined) {
      throw new InvalidPreferencesError(this.name, `"${key}" is not a field`);
    }

    const result = schema.safeParse(value);
    if (!result.success) {
      throw new InvalidPreferencesError(this.name, `"${key}" refuses this value`);
    }

    return result.data;
  }

  #isDefault(
    key: string,
    value: unknown
  ): boolean {
    return samePreferenceValue(this.fields[key]?.default, value);
  }

  #checkChords(
    overrides: PreferenceOverrides,
    changed: readonly string[]
  ): void {
    const bindings = [...this.bindings(overrides)];
    const owners = new Map<string, string>();
    for (const [key, chords] of [
      ...bindings.filter(([key]) => !changed.includes(key)),
      ...bindings.filter(([key]) => changed.includes(key))
    ]) {
      for (const chord of chords) {
        const owner = owners.get(chord);
        if (owner !== undefined && owner !== key) {
          throw new ChordConflictError(this.name, chord, key, owner);
        }
        owners.set(chord, key);
      }
    }
  }
}

export function definePreferences<const TFields extends PreferenceFields>(
  definition: PreferenceScopeDefinition<TFields & EnumDefaults<TFields>>
): PreferenceScope<TFields> {
  return new PreferenceScope(definition);
}

function groupFields<TField extends PreferenceField>(
  fields: Iterable<[string, TField]>
): PreferenceFieldGroup<TField>[] {
  const groups = new Map<string | null, PreferenceFieldGroup<TField>>();
  for (const [key, field] of fields) {
    const label = field.group ?? null;
    const group = groups.get(label) ?? {
      label,
      fields: []
    };
    group.fields.push([key, field]);
    groups.set(label, group);
  }

  return [...groups.values()];
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value);
}
