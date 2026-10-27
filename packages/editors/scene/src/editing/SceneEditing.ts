// Import Third-party Dependencies
import type {
  AssetReferenceData,
  AssetType
} from "@jolly-pixel/asset";
import type {
  SceneDocument,
  SceneEnvironmentPatch
} from "@jolly-pixel/asset.scene/client";
import type { ShortcutLabels } from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { SceneActions } from "./SceneActions.ts";
import type { SceneHistory } from "../features/history/sceneHistory.ts";
import type { GizmoSettings } from "../features/viewport/GizmoSettings.ts";
import type { SceneAction } from "../keybindings/sceneActions.ts";
import type { PresenceStore } from "../state/PresenceStore.ts";
import type { SelectionStore } from "../state/SelectionStore.ts";

export interface SceneAssetSlots {
  name(
    reference: AssetReferenceData
  ): string;
  pick(
    type: AssetType<unknown>,
    current: AssetReferenceData | null
  ): Promise<AssetReferenceData | null>;
  open: (
    (reference: AssetReferenceData) => void
  ) | null;
  subscribe(
    listener: () => void
  ): () => void;
}

export interface SceneEditing {
  document: SceneDocument;
  history: SceneHistory;
  actions: SceneActions;
  selection: SelectionStore;
  presence: PresenceStore;
  gizmo: GizmoSettings;
  assetSlots: SceneAssetSlots;
  shortcuts: ShortcutLabels<SceneAction>;
  frameSelection(): void;
  previewEnvironment(
    patch: SceneEnvironmentPatch
  ): void;
  teleportToPeer(
    clientId: string
  ): void;
}
