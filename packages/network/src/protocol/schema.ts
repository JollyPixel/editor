// Import Third-party Dependencies
import type {
  Infer,
  JSONSchema,
  ValidationError
} from "ata-validator";

export type {
  Infer,
  JSONSchema,
  ValidationError
};

export function defineSchema<const S extends JSONSchema>(
  schema: S
): S {
  return schema;
}

export function describeErrors(
  errors: readonly ValidationError[]
): string {
  return errors
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}
