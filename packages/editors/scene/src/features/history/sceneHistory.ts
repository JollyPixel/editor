// Import Third-party Dependencies
import {
  sceneHistoryRegistration,
  type SceneDocument
} from "@jolly-pixel/asset.scene/client";
import {
  CommandHistory,
  type HistoryRefusal,
  type HistoryStepInfo
} from "@jolly-pixel/history";

// CONSTANTS
const kLimit = 100;

export const SCENE_HISTORY_SCOPE = "scene";

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

export function skippedMessage(
  step: HistoryStepInfo
): string {
  const label = step.label === null ? "a step" : `"${step.label}"`;

  return `Skipped ${label}: ${describeRefusal(step.refused)}`;
}

function describeRefusal(
  refusal: HistoryRefusal
): string {
  switch (refusal.reason) {
    case "peer":
      return refusal.clientId === null ?
        "it was changed since" :
        "a peer changed it since";
    case "changed":
      return "the scene under it changed since";
    case "server":
      return "the server refused it";
    case "closed":
    case "gone":
      return "it is gone";
  }
}
