// Import Third-party Dependencies
import {
  ANIMATION_CHANNELS,
  trackBlockName,
  type AnimationClipJSON,
  type AnimationInterpolation,
  type AnimationTrackJSON
} from "@jolly-pixel/asset.voxel-animation/client";
import {
  bindTracks,
  boundBlocks,
  trackPathOf,
  type AnimationSetLinkJSON,
  type ModelNodeJSON,
  type ModelTreeReader,
  type TrackState
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { displayNameOf } from "../../../model/index.ts";

export interface TimelineKey {
  tick: number;
  interpolation: AnimationInterpolation | "mixed";
}

export interface TimelineRow {
  blockId: string;
  name: string;
  path: string;
  /**
   * Rising, one per tick, whatever channel holds the key.
   */
  keys: TimelineKey[];
  selected: boolean;
}

export interface UnboundTimelineRow {
  path: string;
  name: string;
  state: Exclude<TrackState, "bound">;
  keys: TimelineKey[];
}

export function timelineRows(
  tree: ModelTreeReader,
  clip: AnimationClipJSON,
  link: AnimationSetLinkJSON,
  selectedId: string | null
): TimelineRow[] {
  const tracks = new Map<string, { path: string; keys: TimelineKey[]; }>();
  const bound = boundBlocks(bindTracks(clip.tracks.map(({ path }) => path), link, tree));
  for (const track of clip.tracks) {
    const blockId = bound.get(track.path);
    if (blockId !== undefined && !tracks.has(blockId)) {
      tracks.set(blockId, { path: track.path, keys: keysOf(track) });
    }
  }
  if (selectedId !== null && tree.block(selectedId) !== undefined && !tracks.has(selectedId)) {
    tracks.set(selectedId, { path: trackPathOf(link, tree, selectedId), keys: [] });
  }

  return blocksInOrder(tree).flatMap((block) => {
    const track = tracks.get(block.id);

    return track === undefined ? [] : [{
      blockId: block.id,
      name: displayNameOf(block),
      path: track.path,
      keys: track.keys,
      selected: block.id === selectedId
    }];
  });
}

export function unboundTimelineRows(
  tree: ModelTreeReader,
  clip: AnimationClipJSON,
  link: AnimationSetLinkJSON
): UnboundTimelineRow[] {
  const binding = bindTracks(clip.tracks.map(({ path }) => path), link, tree);

  return clip.tracks.flatMap((track) => {
    const state = binding.get(track.path)?.state ?? "missing";

    return state === "bound" ? [] : [{
      path: track.path,
      name: trackBlockName(track.path),
      state,
      keys: keysOf(track)
    }];
  });
}

function keysOf(
  track: AnimationTrackJSON
): TimelineKey[] {
  const ticks = new Map<number, TimelineKey["interpolation"]>();
  for (const channel of ANIMATION_CHANNELS) {
    for (const { tick, interpolation } of track[channel] ?? []) {
      const known = ticks.get(tick);
      ticks.set(tick, known === undefined || known === interpolation ? interpolation : "mixed");
    }
  }

  return [...ticks]
    .map(([tick, interpolation]) => {
      return { tick, interpolation };
    })
    .sort((left, right) => left.tick - right.tick);
}

function blocksInOrder(
  tree: ModelTreeReader
): ModelNodeJSON[] {
  function visit(
    parentId: string | null
  ): ModelNodeJSON[] {
    return tree.childrenOf(parentId).flatMap((node) => [
      ...node.kind === "block" ? [node] : [],
      ...visit(node.id)
    ]);
  }

  return visit(null);
}
