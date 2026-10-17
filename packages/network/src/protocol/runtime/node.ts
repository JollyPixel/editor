// Import Third-party Dependencies
import {
  Validator,
  type JSONSchema
} from "ata-validator";
import * as z from "zod/mini";

// Import Internal Dependencies
import type {
  Schema,
  ValidationError
} from "../schema.ts";

// CONSTANTS
const kValidatorOptions = {
  useDefaults: false
} as const;
const kValidators = new WeakMap<Schema, Validator>();

function validatorFor(
  schema: Schema
): Validator {
  let validator = kValidators.get(schema);
  if (validator === undefined) {
    const jsonSchema = z.toJSONSchema(schema, { io: "input" }) as JSONSchema;
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
    this.#validator ??= validatorFor(this.#schema);

    return this.#validator;
  }
}
