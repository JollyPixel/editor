// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import type {
  Schema,
  ValidationError
} from "../schema.ts";

// CONSTANTS
const kCompiled = new WeakMap<Schema, Schema>();

let compile: ((schema: Schema) => Schema) | null = null;
let compiler: Promise<void> | null = null;

function loadCompiler(): void {
  compiler ??= import("./compiler.ts").then(
    (module) => {
      compile = module.compile;
    },
    () => undefined
  );
}

function compileSchema(
  schema: Schema
): Schema | null {
  if (compile === null) {
    return null;
  }

  let compiled = kCompiled.get(schema);
  if (compiled === undefined) {
    compiled = compile(schema);
    kCompiled.set(schema, compiled);
  }

  return compiled;
}

export class SchemaValidator {
  #schema: Schema;
  #compiled: Schema | null = null;

  constructor(
    schema: Schema
  ) {
    this.#schema = schema;
    loadCompiler();
  }

  isValid(
    value: unknown
  ): boolean {
    this.#compiled ??= compileSchema(this.#schema);

    return z.safeParse(this.#compiled ?? this.#schema, value).success;
  }

  errors(
    value: unknown
  ): readonly ValidationError[] {
    const result = z.safeParse(this.#schema, value);
    if (result.success) {
      return [];
    }

    return result.error.issues.map((issue) => {
      return {
        instancePath: issue.path.map((key) => `/${String(key)}`).join(""),
        message: issue.message
      };
    });
  }
}
