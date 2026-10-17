// Import Internal Dependencies
import type { Schema } from "../schema.ts";
import {
  SchemaShape,
  isConstValue,
  type ConstValue
} from "./SchemaShape.ts";

// CONSTANTS
const kMaxConstDepth = 3;

interface ConstAt {
  readonly path: readonly string[];
  readonly value: ConstValue;
}

interface DistinguishingConst {
  readonly path: readonly string[];
  readonly values: readonly ConstValue[];
}

export interface GroupedVariant {
  readonly schema: Schema;
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

  matchCandidates(
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
  schemas: readonly Schema[],
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
  schema: Schema,
  path: readonly string[],
  discriminator: string
): Map<string, ConstAt> {
  const consts = new Map<string, ConstAt>();
  const properties = SchemaShape.properties(schema);
  if (path.length >= kMaxConstDepth || properties === null) {
    return consts;
  }

  for (const [key, optional] of Object.entries(properties)) {
    if (path.length === 0 && key === discriminator) {
      continue;
    }

    const nested = [...path, key];
    const property = SchemaShape.unwrapOptional(optional);
    const value = SchemaShape.constOf(property);
    if (value !== undefined) {
      consts.set(JSON.stringify(nested), {
        path: nested,
        value
      });
    }
    for (const [deeper, at] of constsWithin(property, nested, discriminator)) {
      consts.set(deeper, at);
    }
  }

  return consts;
}
