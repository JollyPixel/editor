// Import Third-party Dependencies
import type { Schema } from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { AssetKindDescriptor } from "./AssetKindDescriptor.ts";
import type { AnyAssetKindHandler } from "./AssetKindHandler.ts";

// CONSTANTS
export const SNAPSHOT_POLICY_SCHEMA = z.strictObject({
  delay: z.optional(z.number().check(
    z.minimum(0),
    z.meta({ title: "Delay (ms)" })
  )),
  maxDelay: z.optional(z.number().check(
    z.minimum(0),
    z.meta({ title: "Max delay (ms)" })
  ))
});

export interface AssetKindPackage<
  TOptions extends object = object
> {
  readonly descriptors: readonly AssetKindDescriptor[];
  readonly optionsSchema: Schema;

  handlers(
    options?: TOptions
  ): AnyAssetKindHandler[];
}
