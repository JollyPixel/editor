// Import Third-party Dependencies
import {
  sceneHistoryRegistration,
  type SceneDocument
} from "@jolly-pixel/asset.scene/client";
import {
  CommandHistory,
  type RefusalWording
} from "@jolly-pixel/history";

// CONSTANTS
const kLimit = 100;

export const SCENE_HISTORY_SCOPE = "scene";
export const SCENE_REFUSAL_WORDING: RefusalWording = {
  changed: "the scene under it changed since"
};

export type SceneHistoryScope = typeof SCENE_HISTORY_SCOPE;
export type SceneHistory = CommandHistory<SceneHistoryScope>;

export function createSceneHistory(
  document: SceneDocument
): SceneHistory {
  const history = new CommandHistory<SceneHistoryScope>({
    limit: kLimit
  });
  history.register(
    sceneHistoryRegistration(
      document,
      { scope: SCENE_HISTORY_SCOPE }
    )
  );

  return history;
}
