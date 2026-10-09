// Import Third-party Dependencies
import { sameTrackPath } from "@jolly-pixel/asset.voxel-animation/client";
import {
  bindTracks,
  blockPathOf,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { AnimationLibrary } from "./AnimationLibrary.ts";
import type { ScopeRecorder } from "../../history/index.ts";
import type { BuildRecorder } from "../../../model/index.ts";

export interface AnimationFollowOptions {
  document: ModelDocument;
  animations: Pick<AnimationLibrary, "set">;
}

export function followingBuildEdits(
  history: ScopeRecorder<"build">,
  follow: AnimationFollow
): BuildRecorder {
  return {
    record: (label, edit) => history.record("build", label, () => follow.carry(edit))
  };
}

interface BoundTrack {
  setId: string;
  own: boolean;
  path: string;
  remapped: boolean;
  blockId: string;
  blockPath: string;
}

export class AnimationFollow {
  #document: ModelDocument;
  #animations: Pick<AnimationLibrary, "set">;
  #carrying = false;

  constructor(
    options: AnimationFollowOptions
  ) {
    this.#document = options.document;
    this.#animations = options.animations;
  }

  carry<T>(
    edit: () => T
  ): T {
    if (this.#carrying) {
      return edit();
    }

    const tracks = this.#boundTracks();
    this.#carrying = true;
    let result: T;
    try {
      result = edit();
    }
    finally {
      this.#carrying = false;
    }
    for (const track of tracks) {
      this.#follow(track);
    }

    return result;
  }

  #boundTracks(): BoundTrack[] {
    const { tree } = this.#document;

    return [...tree.animationSets.values()].flatMap((link) => {
      const set = this.#animations.set(link.id)?.document.set;
      if (set === undefined) {
        return [];
      }

      return [...bindTracks(set.trackPaths(), link, tree)].flatMap(([path, { blockId, remap }]) => (
        blockId === null ?
          [] :
          [{
            setId: link.id,
            own: link.own === true,
            path,
            remapped: remap !== null,
            blockId,
            blockPath: blockPathOf(tree, blockId)
          }]
      ));
    });
  }

  #follow(
    track: BoundTrack
  ): void {
    const { tree } = this.#document;
    if (tree.block(track.blockId) === undefined) {
      return;
    }

    const blockPath = blockPathOf(tree, track.blockId);
    if (sameTrackPath(blockPath, track.blockPath)) {
      return;
    }

    const renamed = track.own && this.#renameOwnTrack(track, blockPath);
    this.#retarget(track, renamed || sameTrackPath(track.path, blockPath) ? null : blockPath);
  }

  #retarget(
    track: BoundTrack,
    target: string | null
  ): void {
    if (target !== null) {
      this.#document.remapAnimationTrack(track.setId, track.path, target);
    }
    else if (track.remapped) {
      this.#document.clearAnimationTrackRemap(track.setId, track.path);
    }
  }

  #renameOwnTrack(
    track: BoundTrack,
    to: string
  ): boolean {
    const document = this.#animations.set(track.setId)?.document;
    if (document === undefined) {
      return false;
    }

    const { path } = track;
    const clipIds = [...document.set.clips()]
      .filter((clip) => clip.tracks.some((candidate) => sameTrackPath(candidate.path, path)))
      .map((clip) => clip.id);
    const accepted = clipIds.every((clipId) => document.set.accepts({
      action: "track-renamed",
      clipId,
      path,
      to
    }));
    if (!accepted) {
      return false;
    }

    for (const clipId of clipIds) {
      document.renameTrack(clipId, path, to);
    }

    return true;
  }
}
