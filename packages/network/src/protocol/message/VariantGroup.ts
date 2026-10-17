// Import Internal Dependencies
import type { JSONSchema } from "../schema.ts";

// CONSTANTS
const kMaxConstDepth = 3;

type ConstValue = string | number | boolean;

interface ConstAt {
  readonly path: readonly string[];
  readonly value: ConstValue;
}

interface DistinguishingConst {
  readonly path: readonly string[];
  readonly values: readonly ConstValue[];
}

export interface GroupedVariant {
  readonly schema: JSONSchema;
}

export class VariantGroup<TVariant extends GroupedVariant> {
  #all: readonly TVariant[];
  #untagged: readonly TVariant[];
  #path: readonly string[] | null = null;
  #byConst = new Map<ConstValue, readonly TVariant[]>();

  constructor(
    tagged: readonly TVariant[],
    untagged: readonly TVariant[],
    discriminator: string
  ) {
    this.#all = [...tagged, ...untagged];
    this.#untagged = untagged;
    if (tagged.length < 2) {
      return;
    }

    const distinguishing = distinguishingConst(
      tagged.map(({ schema }) => schema),
      discriminator
    );
    if (distinguishing === null) {
      return;
    }

    this.#path = distinguishing.path;
    for (const [index, value] of distinguishing.values.entries()) {
      this.#byConst.set(value, [tagged[index], ...untagged]);
    }
  }

  candidatesFor(
    payload: object
  ): readonly TVariant[] {
    if (this.#path === null) {
      return this.#all;
    }

    let value: unknown = payload;
    for (const key of this.#path) {
      if (
        typeof value !== "object" ||
        value === null ||
        !Object.hasOwn(value, key)
      ) {
        return this.#all;
      }
      value = Reflect.get(value, key);
    }

    return isConstValue(value) ?
      this.#byConst.get(value) ?? this.#untagged :
      this.#untagged;
  }
}

function distinguishingConst(
  schemas: readonly JSONSchema[],
  discriminator: string
): DistinguishingConst | null {
  const consts = schemas.map(
    (schema) => constsWithin(schema, [], discriminator)
  );

  let shortest: DistinguishingConst | null = null;
  for (const [key, { path }] of consts[0]) {
    if (shortest !== null && path.length >= shortest.path.length) {
      continue;
    }

    const values = consts.map((byPath) => byPath.get(key)?.value);
    if (
      values.every(isConstValue) &&
      new Set(values).size === values.length
    ) {
      shortest = {
        path,
        values
      };
    }
  }

  return shortest;
}

function constsWithin(
  schema: JSONSchema,
  path: readonly string[],
  discriminator: string
): Map<string, ConstAt> {
  const consts = new Map<string, ConstAt>();
  if (path.length >= kMaxConstDepth || schema.properties === undefined) {
    return consts;
  }

  for (const [key, property] of Object.entries(schema.properties)) {
    if (path.length === 0 && key === discriminator) {
      continue;
    }

    const nested = [...path, key];
    if (isConstValue(property.const)) {
      consts.set(JSON.stringify(nested), {
        path: nested,
        value: property.const
      });
    }
    for (const [deeper, at] of constsWithin(property, nested, discriminator)) {
      consts.set(deeper, at);
    }
  }

  return consts;
}

function isConstValue(
  value: unknown
): value is ConstValue {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean";
}
