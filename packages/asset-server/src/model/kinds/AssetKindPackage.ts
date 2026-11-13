// Import Third-party Dependencies
import type { Schema } from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { AssetKindDescriptor } from "./AssetKindDescriptor.ts";
import type { AnyAssetKindHandler } from "./AssetKindHandler.ts";

// CONSTANTS
export const NO_OPTIONS_SCHEMA = z.strictObject({});

export interface AssetKindPackage<
  TOptions extends object = object
> {
  readonly descriptors: readonly AssetKindDescriptor[];
  readonly optionsSchema: Schema;

  handlers(
    options?: TOptions
  ): AnyAssetKindHandler[];
}
