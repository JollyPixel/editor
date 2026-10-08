// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";
import {
  modelHistoryKeys,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";
import {
  animationHistoryKeys,
  type AnimationDocument
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import {
  EDITOR_TABS,
  type EditorTab
} from "../../state/index.ts";
import { describeAnimationChange } from "./describeAnimationChange.ts";
import { describeModelChange } from "./describeModelChange.ts";
import { scopeOfModelChange } from "./scopeOfModelChange.ts";

export type EditorHistory = CommandHistory<EditorTab>;

export interface TabRecorder<TTab extends EditorTab> {
  record<T>(scope: TTab, label: string | null, edit: () => T): T;
}

export interface EditorHistoryOptions {
  document: ModelDocument;
  /**
   * Steps kept per tab; 50 by default.
   */
  limit?: number;
}

export function createEditorHistory(
  options: EditorHistoryOptions
): EditorHistory {
  const history = new CommandHistory({
    scopes: EDITOR_TABS,
    limit: options.limit
  });
  history.register({
    id: "model",
    document: options.document,
    keys: modelHistoryKeys(options.document.tree),
    scopeOf: scopeOfModelChange,
    label: describeModelChange
  });

  return history;
}

export function registerAnimationSet(
  history: Pick<EditorHistory, "register">,
  setId: string,
  document: AnimationDocument
): () => void {
  return history.register({
    id: `set:${setId}`,
    document,
    keys: animationHistoryKeys(document.set),
    scopeOf: () => "animate",
    label: describeAnimationChange
  });
}
