// Import Third-party Dependencies
import * as z from "zod";
import type { Schema } from "@jolly-pixel/network";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  kindOptionVector2Schema,
  type KindOptionField,
  type KindOptionSection
} from "../../src/project/routes.ts";

// CONSTANTS
const kLabelSeparator = " › ";

type JsonSchema = z.core.JSONSchema.BaseSchema;

interface Bounds {
  min?: number;
  max?: number;
}

export class KindOptionSections implements Iterable<KindOptionSection> {
  static read(
    schema: Schema,
    descriptors: Iterable<AssetKindDescriptor>
  ): KindOptionSections {
    const kindLabels = new Map(
      [...descriptors].map(({ kind, label }) => [kind, label])
    );
    const root = section(null);
    const sections = [root];
    const json = z.toJSONSchema(schema, {
      io: "input",
      unrepresentable: "any"
    });
    for (const [key, child] of properties(json)) {
      const kindLabel = kindLabels.get(key);
      if (kindLabel === undefined || child.type !== "object") {
        place(root, child, [key], key);

        continue;
      }

      const kindSection = section(kindLabel);
      for (const [childKey, grandChild] of properties(child)) {
        place(kindSection, grandChild, [key, childKey], childKey);
      }
      sections.push(kindSection);
    }

    return new KindOptionSections(sections.filter(
      (entry) => entry.fields.length > 0 || entry.groups.length > 0
    ));
  }

  #sections: readonly KindOptionSection[];

  constructor(
    sections: Iterable<KindOptionSection>
  ) {
    this.#sections = [...sections];
  }

  [Symbol.iterator](): IterableIterator<KindOptionSection> {
    return this.#sections.values();
  }
}

function section(
  label: string | null
): KindOptionSection {
  return {
    label,
    fields: [],
    groups: []
  };
}

function place(
  target: KindOptionSection,
  schema: JsonSchema,
  path: readonly string[],
  key: string
): void {
  const label = title(schema, key);
  const field = readField(schema, path, label);
  if (field !== null) {
    target.fields.push(field);

    return;
  }

  const fields = collect(schema, path, []);
  if (fields.length > 0) {
    target.groups.push({
      path: [...path],
      label,
      fields
    });
  }
}

function collect(
  schema: JsonSchema,
  path: readonly string[],
  labels: readonly string[]
): KindOptionField[] {
  return properties(schema).flatMap(([key, child]) => {
    const childPath = [...path, key];
    const childLabels = [...labels, title(child, key)];
    const field = readField(
      child,
      childPath,
      childLabels.join(kLabelSeparator)
    );

    return field === null ? collect(child, childPath, childLabels) : [field];
  });
}

function readField(
  schema: JsonSchema,
  path: readonly string[],
  label: string
): KindOptionField | null {
  if (isNumber(schema)) {
    return {
      type: "number",
      path: [...path],
      label,
      ...bounds(schema),
      default: typeof schema.default === "number" ? schema.default : undefined
    };
  }

  const axes = vectorAxes(schema);
  const vectorDefault = kindOptionVector2Schema.safeParse(schema.default);
  if (axes === null || !vectorDefault.success) {
    return null;
  }

  const [x, y] = axes.map(bounds);

  return {
    type: "vector2",
    path: [...path],
    label,
    min: tighter(x.min, y.min, Math.max),
    max: tighter(x.max, y.max, Math.min),
    default: vectorDefault.data
  };
}

function vectorAxes(
  schema: JsonSchema
): [JsonSchema, JsonSchema] | null {
  const axes = new Map(properties(schema));
  const x = axes.get("x");
  const y = axes.get("y");
  if (
    axes.size !== 2 ||
    x === undefined ||
    y === undefined ||
    !isNumber(x) ||
    !isNumber(y)
  ) {
    return null;
  }

  return [x, y];
}

function bounds(
  schema: JsonSchema
): Bounds {
  const { minimum, maximum, exclusiveMinimum, exclusiveMaximum } = schema;
  if (schema.type !== "integer") {
    return {
      min: minimum,
      max: maximum
    };
  }

  return {
    min: tighter(
      minimum,
      typeof exclusiveMinimum === "number" ?
        Math.floor(exclusiveMinimum) + 1 :
        undefined,
      Math.max
    ),
    max: tighter(
      maximum,
      typeof exclusiveMaximum === "number" ?
        Math.ceil(exclusiveMaximum) - 1 :
        undefined,
      Math.min
    )
  };
}

function tighter(
  left: number | undefined,
  right: number | undefined,
  pick: (left: number, right: number) => number
): number | undefined {
  if (left === undefined || right === undefined) {
    return left ?? right;
  }

  return pick(left, right);
}

function isNumber(
  schema: JsonSchema
): boolean {
  return schema.type === "number" || schema.type === "integer";
}

function properties(
  schema: JsonSchema
): [string, JsonSchema][] {
  return Object.entries(schema.properties ?? {}).filter(
    (entry): entry is [string, JsonSchema] => typeof entry[1] === "object"
  );
}

function title(
  schema: JsonSchema,
  key: string
): string {
  return schema.title ?? sentenceCase(key);
}

function sentenceCase(
  key: string
): string {
  const words = key.replaceAll(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}
