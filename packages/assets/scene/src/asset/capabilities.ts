// Import Third-party Dependencies
import { defineCapabilities } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { SceneCommandAction } from "../network/types.ts";

// CONSTANTS
export const SCENE_CAPABILITIES = defineCapabilities<SceneCommandAction>()([
  {
    name: "hierarchy",
    label: "Hierarchy",
    events: [
      "actor-added",
      "actor-removed",
      "actor-moved",
      "actor-renamed",
      "actor-visibility"
    ]
  },
  {
    name: "transforms",
    label: "Transforms",
    events: [
      "actor-transformed"
    ]
  },
  {
    name: "components",
    label: "Components",
    events: [
      "component-added",
      "component-removed",
      "component-moved",
      "component-changed",
      "component-assets-changed"
    ]
  },
  {
    name: "signals",
    label: "Signals",
    events: [
      "connection-added",
      "connection-removed"
    ]
  },
  {
    name: "instances",
    label: "Prefab instances",
    events: [
      "actor-overridden",
      "component-overridden"
    ]
  },
  {
    name: "environment",
    label: "Environment",
    events: [
      "environment-changed"
    ]
  }
]);
