// Import Third-party Dependencies
import {
  TRACK_PATH_SEPARATOR,
  sameTrackPath,
  trackPathKey,
  type AnimationSample
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  AnimationBindingJSON,
  AnimationSetLinkJSON,
  BlockTransformJSON,
  Vector3JSON
} from "../network/types.ts";
import type { ModelTreeReader } from "./ModelTree.ts";

// CONSTANTS
const kDegreesToRadians = Math.PI / 180;

export type TrackState = "bound" | "missing" | "ambiguous" | "ignored";

export interface TrackResolution {
  state: TrackState;
  /**
   * `null` unless bound.
   */
  blockId: string | null;
  remap: AnimationBindingJSON | null;
}

export type TrackBinding = Map<string, TrackResolution>;

export function blockPathOf(
  tree: ModelTreeReader,
  id: string
): string {
  const names: string[] = [];
  for (let current: string | null = id; current !== null; current = tree.transformParentOf(current)) {
    names.unshift(tree.get(current)?.name ?? "");
  }

  return names.join(TRACK_PATH_SEPARATOR);
}

export function blockPaths(
  tree: ModelTreeReader
): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  for (const block of tree.blocks()) {
    const key = trackPathKey(blockPathOf(tree, block.id));
    paths.set(key, [...paths.get(key) ?? [], block.id]);
  }

  return paths;
}

export function bindTracks(
  paths: Iterable<string>,
  link: AnimationSetLinkJSON,
  tree: ModelTreeReader
): TrackBinding {
  const byPath = blockPaths(tree);
  const binding: TrackBinding = new Map();
  for (const path of paths) {
    const remap = link.bindings.find((candidate) => sameTrackPath(candidate.path, path)) ?? null;
    const target = remap === null ? path : remap.target;
    const ids = target === null ? [] : byPath.get(trackPathKey(target)) ?? [];
    binding.set(path, {
      state: target === null ? "ignored" : stateOf(ids),
      blockId: ids.length === 1 && target !== null ? ids[0] : null,
      remap
    });
  }

  return binding;
}

export function boundBlocks(
  binding: TrackBinding
): Map<string, string> {
  const bound = new Map<string, string>();
  for (const [path, { blockId }] of binding) {
    if (blockId !== null) {
      bound.set(path, blockId);
    }
  }

  return bound;
}

export function poseBlock(
  rest: BlockTransformJSON,
  sample: AnimationSample
): BlockTransformJSON {
  return {
    ...rest,
    position: sample.position === undefined ?
      rest.position :
      combine(rest.position, sample.position, (base, delta) => base + delta),
    rotation: sample.rotation === undefined ?
      rest.rotation :
      combine(rest.rotation, sample.rotation, (base, delta) => base + (delta * kDegreesToRadians)),
    scale: sample.scale === undefined ?
      rest.scale :
      combine(rest.scale, sample.scale, (base, factor) => base * factor)
  };
}

export function poseDelta(
  rest: BlockTransformJSON,
  pose: BlockTransformJSON
): Required<AnimationSample> {
  return {
    position: combine(pose.position, rest.position, (posed, base) => posed - base),
    rotation: combine(pose.rotation, rest.rotation, (posed, base) => (posed - base) / kDegreesToRadians),
    scale: combine(pose.scale, rest.scale, (posed, base) => (base === 0 ? 1 : posed / base))
  };
}

export function trackPathOf(
  link: AnimationSetLinkJSON,
  tree: ModelTreeReader,
  id: string,
  paths: Iterable<string> = []
): string {
  for (const [path, { blockId }] of bindTracks(paths, link, tree)) {
    if (blockId === id) {
      return path;
    }
  }

  const own = blockPathOf(tree, id);

  return link.bindings.find(({ target }) => target !== null && sameTrackPath(target, own))?.path ?? own;
}

function stateOf(
  ids: readonly string[]
): TrackState {
  if (ids.length === 0) {
    return "missing";
  }

  return ids.length === 1 ? "bound" : "ambiguous";
}

function combine(
  base: Vector3JSON,
  delta: Vector3JSON,
  merge: (base: number, delta: number) => number
): Vector3JSON {
  return {
    x: merge(base.x, delta.x),
    y: merge(base.y, delta.y),
    z: merge(base.z, delta.z)
  };
}
