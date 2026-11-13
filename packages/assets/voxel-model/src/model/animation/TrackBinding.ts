// Import Third-party Dependencies
import { TrackPath } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  AnimationBindingJSON,
  AnimationSetLinkJSON
} from "../types.ts";
import type { ModelTreeReader } from "../ModelTree.ts";
import { AnimationSetLink } from "./AnimationSetLink.ts";

export type TrackState = "bound" | "missing" | "ambiguous" | "ignored";

export type TrackResolution =
  | {
    state: "bound";
    blockId: string;
    remap: AnimationBindingJSON | null;
  }
  | {
    state: Exclude<TrackState, "bound">;
    blockId: null;
    remap: AnimationBindingJSON | null;
  };

export function buildBlockPath(
  tree: ModelTreeReader,
  id: string
): string {
  const names: string[] = [];
  for (let current: string | null = id; current !== null; current = tree.nodes.findTransformParent(current)) {
    names.unshift(tree.nodes.get(current)?.name ?? "");
  }

  return names.join(TrackPath.SEPARATOR);
}

export class TrackBinding {
  static #resolve(
    ids: readonly string[],
    remap: AnimationBindingJSON | null
  ): TrackResolution {
    if (ids.length === 1) {
      return { state: "bound", blockId: ids[0], remap };
    }

    return {
      state: ids.length === 0 ? "missing" : "ambiguous",
      blockId: null,
      remap
    };
  }

  readonly #link: AnimationSetLink;
  readonly #tree: ModelTreeReader;
  readonly #tracks = new Map<string, TrackResolution>();

  constructor(
    paths: Iterable<string>,
    link: AnimationSetLinkJSON,
    tree: ModelTreeReader
  ) {
    this.#link = AnimationSetLink.parse(link);
    this.#tree = tree;

    const byPath = blockPaths(tree);
    for (const path of paths) {
      const remap = this.#link.findBinding(path) ?? null;
      const target = remap === null ? path : remap.target;
      this.#tracks.set(path, target === null ?
        { state: "ignored", blockId: null, remap } :
        TrackBinding.#resolve(byPath.get(new TrackPath(target).key) ?? [], remap));
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

  trackPath(
    blockId: string
  ): string {
    for (const [path, resolution] of this.#tracks) {
      if (resolution.blockId === blockId) {
        return path;
      }
    }

    const own = buildBlockPath(this.#tree, blockId);

    return this.#link.pathTargeting(own) ?? own;
  }
}

function blockPaths(
  tree: ModelTreeReader
): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  for (const block of tree.nodes.blocks()) {
    const { key } = new TrackPath(buildBlockPath(tree, block.id));
    paths.set(key, [...paths.get(key) ?? [], block.id]);
  }

  return paths;
}
