// Import Third-party Dependencies
import * as z from "zod/mini";

export type Schema = z.core.$ZodType;

type ReadonlyFields<TValue> = TValue extends readonly unknown[] ?
  { -readonly [TKey in keyof TValue]: ReadonlyFields<TValue[TKey]> } :
  TValue extends object ?
    string extends keyof TValue ?
      { [TKey in keyof TValue]: ReadonlyFields<TValue[TKey]> } :
      { readonly [TKey in keyof TValue]: ReadonlyFields<TValue[TKey]> } :
    TValue;

export type Infer<
  TSchema extends Schema
> = ReadonlyFields<z.infer<TSchema>>;

export interface ValidationError {
  readonly instancePath: string;
  readonly message: string;
}

export function isSchema(
  value: unknown
): value is Schema {
  return typeof value === "object" &&
    value !== null &&
    "_zod" in value;
}

export function minProperties<
  TSchema extends z.ZodMiniType<object>
>(
  schema: TSchema,
  min: number
): TSchema {
  return refine(
    schema,
    (value: object) => Object.keys(value).length >= min,
    { minProperties: min }
  );
}

export function dependentRequired<
  TSchema extends z.ZodMiniType<object>
>(
  schema: TSchema,
  dependencies: Readonly<Record<string, readonly string[]>>
): TSchema {
  return refine(
    schema,
    (value: object) => Object.entries(dependencies).every(
      ([key, required]) => !isPresent(value, key) ||
        required.every((other) => isPresent(value, other))
    ),
    { dependentRequired: dependencies }
  );
}

export function requiredAnyOf<
  TSchema extends z.ZodMiniType<object>
>(
  schema: TSchema,
  groups: readonly (readonly string[])[]
): TSchema {
  return refine(
    schema,
    (value: object) => groups.some(
      (required) => required.every((key) => isPresent(value, key))
    ),
    {
      anyOf: groups.map((required) => {
        return { required };
      })
    }
  );
}

export function notMultipleOf<
  TSchema extends z.ZodMiniType<number>
>(
  schema: TSchema,
  divisor: number
): TSchema {
  return refine(
    schema,
    (value: number) => value % divisor !== 0,
    { not: { multipleOf: divisor } }
  );
}

export function describeErrors(
  errors: readonly ValidationError[]
): string {
  return errors
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}

function refine<
  TOutput,
  TSchema extends z.ZodMiniType<TOutput>
>(
  schema: TSchema,
  predicate: (value: TOutput) => boolean,
  keywords: Readonly<Record<string, unknown>>
): TSchema {
  const refined = schema.check(z.refine(predicate));
  z.globalRegistry.add(refined, keywords);

  return refined;
}

function isPresent(
  value: object,
  key: string
): boolean {
  return Reflect.get(value, key) !== undefined;
}
