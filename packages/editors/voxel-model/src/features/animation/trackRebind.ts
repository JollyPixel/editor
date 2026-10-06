// Import Third-party Dependencies
import {
  blockPathOf,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { TabRecorder } from "../history/index.ts";
import {
  pickerMenu,
  type MenuSession
} from "../../shared/menuSession.ts";

export interface TrackRebindWorkspace {
  document: ModelDocument;
  history: TabRecorder<"animate">;
}

export function rebindMenu(
  workspace: TrackRebindWorkspace,
  setId: string,
  path: string
): MenuSession {
  const { tree } = workspace.document;
  const options = [...tree.blocks()].map(({ id }) => {
    const target = blockPathOf(tree, id);

    return { label: target, value: target };
  });

  return pickerMenu(
    options,
    "The model has no block",
    (target) => remapTrack(workspace, setId, path, target)
  );
}

export function remapTrack(
  workspace: TrackRebindWorkspace,
  setId: string,
  path: string,
  target: string | null
): void {
  workspace.history.record(
    "animate",
    target === null ? `Ignore ${path}` : `Rebind ${path}`,
    () => workspace.document.remapAnimationTrack(setId, path, target)
  );
}
