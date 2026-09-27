// Import Third-party Dependencies
import { Validator } from "ata-validator";
import {
  Ok,
  Err,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import {
  VALIDATOR_OPTIONS,
  type Infer,
  type JSONSchema,
  type ValidationError
} from "./schema.ts";

/**
 * Checks values against one JSON Schema. The schema compiles on the first
 * `parse()`, so constructing a parser at module load costs nothing.
 */
export class SchemaParser<
  const TSchema extends JSONSchema
> {
  readonly schema: TSchema;

  #validator: Validator<Infer<TSchema>>;

  constructor(
    schema: TSchema
  ) {
    this.schema = schema;
    this.#validator = new Validator<Infer<TSchema>>(
      schema,
      VALIDATOR_OPTIONS
    );
  }

  parse(
    value: unknown
  ): Result<Infer<TSchema>, readonly ValidationError[]> {
    const result = this.#validator.validate(value);

    return result.valid
      ? Ok(result.data)
      : Err(result.errors);
  }
}
