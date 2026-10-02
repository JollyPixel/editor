// Import Third-party Dependencies
import {
  defineSchema,
  type JSONSchema
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetKindDescriptor } from "./AssetKindDescriptor.ts";
import type { AssetKindHandler } from "./AssetKindHandler.ts";

// CONSTANTS
export const SNAPSHOT_POLICY_SCHEMA = defineSchema({
  type: "object",
  properties: {
    delay: {
      type: "number",
      minimum: 0
    },
    maxDelay: {
      type: "number",
      minimum: 0
    }
  },
  additionalProperties: false
});

export interface AssetKindPackage<
  TOptions extends object = object
> {
  readonly descriptors: readonly AssetKindDescriptor[];
  readonly optionsSchema: JSONSchema;

  handlers(
    options?: TOptions
  ): AssetKindHandler[];
}
