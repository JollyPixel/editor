// Import Third-party Dependencies
import type { GolemKindList } from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import type { EnvironmentAsset } from "./EnvironmentAsset.ts";
import { ENVIRONMENT_GOLEM_KIND } from "./environmentGolemKind.ts";

export * from "./EnvironmentAsset.ts";
export type { EnvironmentPatch } from "./EnvironmentPatch.ts";

declare module "@jolly-pixel/golem.kit" {
  interface GolemAssets {
    environment: EnvironmentAsset;
  }
}

export const GOLEM_KINDS: GolemKindList = [
  ENVIRONMENT_GOLEM_KIND
];
