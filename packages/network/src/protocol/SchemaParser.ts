// Import Third-party Dependencies
import {
  Ok,
  Err,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import { SchemaValidator } from "#schema-runtime";
import type {
  Infer,
  Schema,
  ValidationError
} from "./schema.ts";

export class SchemaParser<
  const TSchema extends Schema
> {
  readonly schema: TSchema;

  #validator: SchemaValidator;

  constructor(
    schema: TSchema
  ) {
    this.schema = schema;
    this.#validator = new SchemaValidator(schema);
  }

  is(
    value: unknown
  ): value is Infer<TSchema> {
    return this.#validator.isValid(value);
  }

  parse(
    value: unknown
  ): Result<Infer<TSchema>, readonly ValidationError[]> {
    return this.is(value)
      ? Ok(value)
      : Err(this.#validator.errors(value));
  }
}
