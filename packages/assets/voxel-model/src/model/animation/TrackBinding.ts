// Import Third-party Dependencies
import { TrackPath } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  AnimationBindingJSON,
  AnimationSetLinkJSON
} from "../../network/types.ts";
import type { ModelTreeReader } from "../ModelTree.ts";
import { AnimationSetLink } from "./AnimationSetLink.ts";

export type TrackState = "bound" | "missing" | "ambiguous" | "ignored";

export interface TrackResolution {
  state: TrackState;
  /**
   * `null` unless bound.
   */
  blockId: string | null;
  remap: AnimationBindingJSON | null;
}

export function blockPathOf(
  tree: ModelTreeReader,
  id: string
): string {
  const names: string[] = [];
  for (let current: string | null = id; current !== null; current = tree.transformParentOf(current)) {
    names.unshift(tree.get(current)?.name ?? "");
  }

  return names.join(TrackPath.SEPARATOR);
}

export class TrackBinding {
  readonly #link: AnimationSetLink;
  readonly #tree: ModelTreeReader;
  readonly #tracks = new Map<string, TrackResolution>();

  constructor(
    paths: Iterable<string>,
    link: AnimationSetLinkJSON,
    tree: ModelTreeReader
  ) {
    this.#link = new AnimationSetLink(link);
    this.#tree = tree;

    const byPath = blockPaths(tree);
    for (const path of paths) {
      const remap = this.#link.bindingOf(path) ?? null;
      const target = remap === null ? path : remap.target;
      const ids = target === null ? [] : byPath.get(new TrackPath(target).key) ?? [];
      this.#tracks.set(path, {
        state: target === null ? "ignored" : stateOf(ids),
        blockId: ids.length === 1 && target !== null ? ids[0] : null,
        remap
      });
    }
  }

  get(
    path: string
  ): TrackResolution | undefined {
    return this.#tracks.get(path);
  }

  [Symbol.iterator](): IterableIterator<[string, TrackResolution]> {
    return this.#tracks.entries();
  }

  bound(): Map<string, string> {
    const bound = new Map<string, string>();
    for (const [path, { blockId }] of this.#tracks) {
      if (blockId !== null) {
        bound.set(path, blockId);
      }
    }

    return bound;
  }

  pathOf(
    blockId: string
  ): string {
    for (const [path, resolution] of this.#tracks) {
      if (resolution.blockId === blockId) {
        return path;
      }
    }

    const own = blockPathOf(this.#tree, blockId);

    return this.#link.pathTargeting(own) ?? own;
  }
}

function blockPaths(
  tree: ModelTreeReader
): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  for (const block of tree.blocks()) {
    const { key } = new TrackPath(blockPathOf(tree, block.id));
    paths.set(key, [...paths.get(key) ?? [], block.id]);
  }

  return paths;
}

function stateOf(
  ids: readonly string[]
): TrackState {
  if (ids.length === 0) {
    return "missing";
  }

  return ids.length === 1 ? "bound" : "ambiguous";
}
