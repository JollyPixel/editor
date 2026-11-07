// Import Third-party Dependencies
import {
  Validator,
  type JSONSchema
} from "ata-validator";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  bytesSchema,
  type Schema,
  type ValidationError
} from "../schema.ts";

// CONSTANTS
const kBytesKeyword = "bytes";
const kValidatorOptions = {
  useDefaults: false,
  keywords: {
    [kBytesKeyword]: {
      validate: (_schema: unknown, data: unknown) => data instanceof Uint8Array
    }
  }
};
const kValidators = new WeakMap<Schema, Validator>();

function representBytes(
  context: { zodSchema: unknown; }
): Record<string, unknown> | "throw" {
  return context.zodSchema === bytesSchema ?
    { [kBytesKeyword]: true } :
    "throw";
}

function compileValidator(
  schema: Schema
): Validator {
  let validator = kValidators.get(schema);
  if (validator === undefined) {
    const jsonSchema = z.toJSONSchema(schema, {
      io: "input",
      unrepresentable: representBytes
    }) as JSONSchema;
    validator = new Validator(jsonSchema, kValidatorOptions);
    kValidators.set(schema, validator);
  }

  return validator;
}

export class SchemaValidator {
  #schema: Schema;
  #validator: Validator | null = null;

  constructor(
    schema: Schema
  ) {
    this.#schema = schema;
  }

  isValid(
    value: unknown
  ): boolean {
    return this.#compiled.isValidObject(value);
  }

  errors(
    value: unknown
  ): readonly ValidationError[] {
    return this.#compiled.validate(value).errors;
  }

  get #compiled(): Validator {
    this.#validator ??= compileValidator(this.#schema);

    return this.#validator;
  }
}
