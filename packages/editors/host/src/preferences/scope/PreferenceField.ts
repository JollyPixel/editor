// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
export const MAX_CHORDS = 4;
export const MAX_ENTRIES_LENGTH = 32 * 1_024;
const kMaxChordLength = 64;
const kTextSchema = z.string().check(z.minLength(1), z.maxLength(80));
const kChordSchema = z.string().check(
  z.minLength(1),
  z.maxLength(kMaxChordLength)
);
export const CHORDS_SCHEMA = z.readonly(
  z.array(kChordSchema).check(z.maxLength(MAX_CHORDS))
);
const kColorSchema = z.nullable(
  z.string().check(z.regex(/^#[\da-f]{6}$/i), z.toLowerCase())
);
const kEntriesSchema = z.record(z.string(), z.string()).check(
  z.refine((entries) => JSON.stringify(entries).length <= MAX_ENTRIES_LENGTH)
);
const kFieldBaseShape = {
  label: kTextSchema,
  group: z.optional(kTextSchema),
  description: z.optional(z.string().check(z.maxLength(200)))
};

export const preferenceFieldSchema = z.discriminatedUnion("type", [
  z.object({
    ...kFieldBaseShape,
    type: z.literal("boolean"),
    default: z.boolean()
  }),
  z.object({
    ...kFieldBaseShape,
    type: z.literal("enum"),
    options: z.readonly(z.array(z.object({
      value: kTextSchema,
      label: kTextSchema
    })).check(z.minLength(1))),
    default: kTextSchema
  }),
  z.object({
    ...kFieldBaseShape,
    type: z.literal("range"),
    min: z.number(),
    max: z.number(),
    step: z.optional(z.number().check(z.positive())),
    default: z.number()
  }),
  z.object({
    ...kFieldBaseShape,
    type: z.literal("chord"),
    default: CHORDS_SCHEMA
  }),
  z.object({
    ...kFieldBaseShape,
    type: z.literal("color"),
    default: kColorSchema
  }),
  z.object({
    ...kFieldBaseShape,
    type: z.literal("entries"),
    default: kEntriesSchema
  })
]);

interface PreferenceFieldBase {
  label: string;
  /**
   * Heading the field is listed under on its Settings page.
   */
  group?: string;
  description?: string;
}

export interface BooleanPreference extends PreferenceFieldBase {
  type: "boolean";
  default: boolean;
}

export interface EnumOption<TValue extends string = string> {
  value: TValue;
  label: string;
}

export interface EnumPreference<
  TValue extends string = string
> extends PreferenceFieldBase {
  type: "enum";
  options: readonly EnumOption<TValue>[];
  default: NoInfer<TValue>;
}

export interface RangePreference extends PreferenceFieldBase {
  type: "range";
  min: number;
  max: number;
  /**
   * @default 1
   */
  step?: number;
  default: number;
}

export interface ChordPreference extends PreferenceFieldBase {
  type: "chord";
  /**
   * Key chord strings, as `KeyChord.toString()` writes them. An empty
   * list leaves the action unbound.
   */
  default: readonly string[];
}

export interface ColorPreference extends PreferenceFieldBase {
  type: "color";
  /**
   * A `#rrggbb` color, or `null` for none.
   */
  default: string | null;
}

export interface EntriesPreference extends PreferenceFieldBase {
  type: "entries";
  /**
   * String values by key, what a `StorageAdapter` holds. Settings shows no
   * form for it, only a Clear action.
   */
  default: Readonly<Record<string, string>>;
}

export type PreferenceField =
  | BooleanPreference
  | EnumPreference
  | RangePreference
  | ChordPreference
  | ColorPreference
  | EntriesPreference;

export type PreferenceFieldType = PreferenceField["type"];

export type FormPreference = Exclude<PreferenceField, ChordPreference>;

export type PreferenceValue<TField extends PreferenceField> =
  TField extends BooleanPreference ? boolean :
    TField extends EnumPreference<infer TValue> ? TValue :
      TField extends RangePreference ? number :
        TField extends ChordPreference ? readonly string[] :
          TField extends ColorPreference ? string | null :
            Readonly<Record<string, string>>;

export function preferenceValueSchema(
  field: PreferenceField
): z.ZodMiniType<unknown> {
  switch (field.type) {
    case "boolean":
      return z.boolean();
    case "enum":
      return z.enum(field.options.map((option) => option.value));
    case "range":
      return z.number().check(z.gte(field.min), z.lte(field.max));
    case "chord":
      return CHORDS_SCHEMA;
    case "color":
      return kColorSchema;
    case "entries":
      return kEntriesSchema;
    default:
      return field satisfies never;
  }
}

export function samePreferenceValue(
  left: unknown,
  right: unknown
): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }
  if (isEntries(left) && isEntries(right)) {
    const keys = Object.keys(left);

    return keys.length === Object.keys(right).length &&
      keys.every((key) => left[key] === right[key]);
  }

  return Object.is(left, right);
}

function isEntries(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
