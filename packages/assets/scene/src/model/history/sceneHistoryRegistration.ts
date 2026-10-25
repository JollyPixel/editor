// Import Third-party Dependencies
import type { HistoryRegistration } from "@jolly-pixel/history";

// Import Internal Dependencies
import type { SceneDocument } from "../SceneDocument.ts";
import type { SceneImage } from "./sceneImages.ts";
import { sceneHistoryKeys } from "./sceneHistoryKeys.ts";
import type {
  SceneCommand,
  SceneCommandAction
} from "../../network/types.ts";

// CONSTANTS
const kDefaultId = "scene";
const kLabels: Readonly<Record<SceneCommandAction, string>> = {
  "actor-added": "Add actor",
  "actor-removed": "Remove actor",
  "actor-moved": "Move actor",
  "actor-renamed": "Rename actor",
  "actor-visibility": "Change visibility",
  "actor-transformed": "Transform actor",
  "component-added": "Add component",
  "component-removed": "Remove component",
  "component-moved": "Reorder components",
  "component-changed": "Edit component",
  "component-assets-changed": "Change component asset",
  "environment-changed": "Edit environment"
};

export interface SceneHistoryRegistrationOptions<TScope extends string> {
  /**
   * @default "scene"
   */
  id?: string;
  scope: TScope;
}

export function sceneHistoryRegistration<TScope extends string>(
  document: SceneDocument,
  options: SceneHistoryRegistrationOptions<TScope>
): HistoryRegistration<TScope, SceneCommand, SceneImage> {
  const { id = kDefaultId, scope } = options;

  return {
    id,
    document,
    keys: sceneHistoryKeys(document.tree),
    resolveScope: () => scope,
    label: ({ command }) => kLabels[command.action]
  };
}
