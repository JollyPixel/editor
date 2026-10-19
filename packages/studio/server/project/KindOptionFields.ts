// Import Third-party Dependencies
import * as z from "zod";
import type { Schema } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { KindOptionField } from "../../src/project/routes.ts";

// CONSTANTS
const kLabelSeparator = " › ";

type JsonSchema = z.core.JSONSchema.BaseSchema;

export class KindOptionFields implements Iterable<KindOptionField> {
  static read(
    schema: Schema
  ): KindOptionFields {
    const fields: KindOptionField[] = [];
    collect(
      z.toJSONSchema(schema, {
        io: "input",
        unrepresentable: "any"
      }),
      [],
      [],
      fields
    );

    return new KindOptionFields(fields);
  }

  #fields: readonly KindOptionField[];

  constructor(
    fields: Iterable<KindOptionField>
  ) {
    this.#fields = [...fields];
  }

  [Symbol.iterator](): IterableIterator<KindOptionField> {
    return this.#fields.values();
  }
}

function collect(
  schema: JsonSchema,
  path: readonly string[],
  labels: readonly string[],
  fields: KindOptionField[]
): void {
  if (schema.type === "number" || schema.type === "integer") {
    fields.push({
      path: [...path],
      label: labels.join(kLabelSeparator),
      min: schema.minimum,
      max: schema.maximum
    });

    return;
  }
  if (schema.type !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    if (typeof child === "object") {
      collect(
        child,
        [...path, key],
        [...labels, child.title ?? sentenceCase(key)],
        fields
      );
    }
  }
}

function sentenceCase(
  key: string
): string {
  const words = key.replaceAll(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}
