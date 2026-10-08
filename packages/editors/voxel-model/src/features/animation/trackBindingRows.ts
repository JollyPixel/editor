// Import Third-party Dependencies
import type { AnimationSetReader } from "@jolly-pixel/asset.voxel-animation/client";
import {
  bindTracks,
  type AnimationSetLinkJSON,
  type ModelTreeReader
} from "@jolly-pixel/asset.voxel-model/client";

export type TrackBindingState = "missing" | "ambiguous" | "ignored" | "remapped";

export const TRACK_STATE_LABELS: Readonly<Record<TrackBindingState, string>> = {
  missing: "No block",
  ambiguous: "Several blocks",
  ignored: "Ignored",
  remapped: "Remapped"
};

export interface TrackBindingRow {
  path: string;
  state: TrackBindingState;
  /**
   * `null` without a remap, or for an ignored track.
   */
  target: string | null;
  remapped: boolean;
}

export function trackBindingRows(
  set: AnimationSetReader,
  link: AnimationSetLinkJSON,
  tree: ModelTreeReader
): TrackBindingRow[] {
  return [...bindTracks(set.trackPaths(), link, tree)].flatMap(([path, { state, remap }]) => {
    if (state === "bound" && remap === null) {
      return [];
    }

    return [{
      path,
      state: state === "bound" ? "remapped" : state,
      target: remap?.target ?? null,
      remapped: remap !== null
    }];
  });
}
