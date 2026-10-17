// Import Third-party Dependencies
import type { Schema } from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { AssetKindDescriptor } from "./AssetKindDescriptor.ts";
import type { AssetKindHandler } from "./AssetKindHandler.ts";

// CONSTANTS
export const SNAPSHOT_POLICY_SCHEMA = z.strictObject({
  delay: z.optional(z.number().check(z.minimum(0))),
  maxDelay: z.optional(z.number().check(z.minimum(0)))
});

export interface AssetKindPackage<
  TOptions extends object = object
> {
  readonly descriptors: readonly AssetKindDescriptor[];
  readonly optionsSchema: Schema;

  handlers(
    options?: TOptions
  ): AssetKindHandler[];
}
