// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";
import {
  modelChangeLabel,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { EditorTab } from "../../state/index.ts";
import type { AnimationScope } from "./animationScopes.ts";
import { scopeOfModelChange } from "./scopeOfModelChange.ts";

export type TabHistoryScope = Exclude<EditorTab, "animate">;
export type EditorHistoryScope = TabHistoryScope | AnimationScope;
export type EditorHistory = CommandHistory<EditorHistoryScope>;

export function isTabHistoryScope(
  tab: EditorTab
): tab is TabHistoryScope {
  return tab !== "animate";
}

export interface ScopeRecorder<TScope extends EditorHistoryScope> {
  record<T>(
    scope: TScope,
    label: string | null,
    edit: () => T
  ): T;
}

export interface EditorHistoryOptions {
  document: ModelDocument;
  /**
   * Steps kept per scope; 50 by default.
   */
  limit?: number;
}

export function createEditorHistory(
  options: EditorHistoryOptions
): EditorHistory {
  const { document } = options;
  const history = new CommandHistory<EditorHistoryScope>({ limit: options.limit });
  history.register({
    id: "model",
    document,
    keys: document.historyKeys,
    resolveScope: (change) => scopeOfModelChange(change, document.tree.animationSets),
    label: modelChangeLabel
  });

  return history;
}
