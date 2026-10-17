// Import Third-party Dependencies
import {
  describeErrors,
  isSchema,
  SchemaParser
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import type {
  AssetKindDescriptor,
  LoadedAssetKind
} from "../kinds/AssetKindDescriptor.ts";
import type { AssetKindHandler } from "../kinds/AssetKindHandler.ts";
import type { AssetKindPackage } from "../kinds/AssetKindPackage.ts";

// CONSTANTS
export const KINDS_EXPORT = "ASSET_KINDS";
const kDescriptorsParser = new SchemaParser(z.array(z.object({
  kind: z.string(),
  label: z.string(),
  extension: z.string(),
  icon: z.optional(z.object({
    svg: z.string(),
    tone: z.optional(z.string()),
    viewBox: z.optional(z.string())
  }))
})));

export type PackageLoader = (
  packageName: string
) => Promise<unknown>;

export class KindPackage {
  readonly name: string;
  readonly options: Readonly<Record<string, unknown>>;
  readonly descriptors: readonly LoadedAssetKind[];
  readonly handlers: readonly AssetKindHandler[];

  static async load(
    name: string,
    options: Readonly<Record<string, unknown>>,
    load: PackageLoader
  ): Promise<KindPackage> {
    let exports: unknown;
    try {
      exports = await load(name);
    }
    catch (error) {
      throw new TypeError(
        `Cannot load the kind package "${name}".`,
        { cause: error }
      );
    }

    const kinds = typeof exports === "object" && exports !== null &&
      KINDS_EXPORT in exports ? exports[KINDS_EXPORT] : undefined;
    if (!isAssetKindPackage(kinds)) {
      throw new TypeError(`"${name}" does not export "${KINDS_EXPORT}".`);
    }

    const descriptors = kDescriptorsParser.parse(
      kinds.descriptors
    );
    if (descriptors.err) {
      throw new TypeError(
        `"${name}" exports invalid "${KINDS_EXPORT}" descriptors.`
      );
    }

    const parsedOptions = new SchemaParser(
      kinds.optionsSchema
    ).parse(options);
    if (parsedOptions.err) {
      throw new TypeError(
        `"${name}" received invalid options: ${describeErrors(parsedOptions.val)}`
      );
    }

    return new KindPackage({
      name,
      options,
      descriptors: descriptors.val,
      handlers: kinds.handlers(options)
    });
  }

  constructor(
    data: {
      name: string;
      options: Readonly<Record<string, unknown>>;
      descriptors: readonly AssetKindDescriptor[];
      handlers: readonly AssetKindHandler[];
    }
  ) {
    const handlers = new Map(
      data.handlers.map((handler) => [handler.kind, handler])
    );
    this.descriptors = data.descriptors.map((descriptor) => {
      const handler = handlers.get(descriptor.kind);
      if (handler === undefined) {
        throw new TypeError(
          `"${data.name}" describes the asset kind "${descriptor.kind}" without handling it.`
        );
      }

      return {
        ...descriptor,
        convertsFrom: Object.keys(handler.conversions ?? {})
      };
    });
    this.name = data.name;
    this.options = structuredClone(data.options);
    this.handlers = [...data.handlers];
  }
}

function isAssetKindPackage(
  value: unknown
): value is AssetKindPackage {
  return typeof value === "object" &&
    value !== null &&
    "descriptors" in value &&
    "handlers" in value &&
    typeof value.handlers === "function" &&
    "optionsSchema" in value &&
    isSchema(value.optionsSchema);
}
