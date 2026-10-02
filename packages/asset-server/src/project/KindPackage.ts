// Import Third-party Dependencies
import {
  defineSchema,
  describeErrors,
  SchemaParser
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetKindDescriptor } from "../kinds/AssetKindDescriptor.ts";
import type { AssetKindHandler } from "../kinds/AssetKindHandler.ts";
import type { AssetKindPackage } from "../kinds/AssetKindPackage.ts";

// CONSTANTS
export const KINDS_EXPORT = "ASSET_KINDS";
const kDescriptorsParser = new SchemaParser(defineSchema({
  type: "array",
  items: {
    type: "object",
    properties: {
      kind: { type: "string" },
      label: { type: "string" },
      extension: { type: "string" },
      icon: {
        type: "object",
        properties: {
          svg: { type: "string" },
          tone: { type: "string" },
          viewBox: { type: "string" }
        },
        required: ["svg"]
      }
    },
    required: [
      "kind",
      "label",
      "extension"
    ]
  }
}));

export type PackageLoader = (packageName: string) => Promise<unknown>;

export class KindPackage {
  readonly name: string;
  readonly options: Readonly<Record<string, unknown>>;
  readonly descriptors: readonly AssetKindDescriptor[];
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

    const descriptors = kDescriptorsParser.parse(kinds.descriptors);
    if (descriptors.err) {
      throw new TypeError(
        `"${name}" exports invalid "${KINDS_EXPORT}" descriptors.`
      );
    }

    const parsedOptions = new SchemaParser(kinds.optionsSchema).parse(options);
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
    const handled = new Set(data.handlers.map((handler) => handler.kind));
    const unhandled = data.descriptors.find(
      (descriptor) => !handled.has(descriptor.kind)
    );
    if (unhandled !== undefined) {
      throw new TypeError(
        `"${data.name}" describes the asset kind "${unhandled.kind}" without handling it.`
      );
    }

    this.name = data.name;
    this.options = structuredClone(data.options);
    this.descriptors = [...data.descriptors];
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
    typeof value.optionsSchema === "object" &&
    value.optionsSchema !== null;
}
