// Import Third-party Dependencies
import {
  sampleClip,
  type AnimationClipJSON
} from "@jolly-pixel/asset.voxel-animation/client";
import {
  bindTracks,
  boundBlocks,
  poseBlock,
  type BlockTransformJSON,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { AnimationSession } from "./AnimationSession.ts";
import type { ModelBlocks } from "../../scene/index.ts";

export interface AnimationPoserOptions {
  document: ModelDocument;
  blocks: Pick<ModelBlocks, "applyTransform">;
  session: AnimationSession;
  requestFrame(): void;
}

interface PosedClip {
  clip: AnimationClipJSON;
  bound: ReadonlyMap<string, string>;
}

export class AnimationPoser {
  #options: AnimationPoserOptions;
  #clip: PosedClip | null = null;
  #posed = new Set<string>();
  #unsubscribe: Array<() => void>;

  constructor(
    options: AnimationPoserOptions
  ) {
    this.#options = options;
    this.#unsubscribe = [
      options.session.subscribe("clip", this.#onClip),
      options.session.subscribe("playhead", this.#update)
    ];
    this.#onClip();
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe.splice(0)) {
      unsubscribe();
    }
    this.#pose(new Map());
  }

  reset(
    blockId: string
  ): void {
    const { document, blocks, requestFrame } = this.#options;
    const transform = this.#poses().get(blockId) ?? document.tree.block(blockId)?.transform;
    if (transform !== undefined) {
      blocks.applyTransform(blockId, transform);
      requestFrame();
    }
  }

  readonly #onClip = (): void => {
    this.#clip = null;
    this.#update();
  };

  readonly #update = (): void => {
    this.#pose(this.#poses());
  };

  #posedClip(): PosedClip | null {
    const focused = this.#options.session.focused;
    if (this.#clip === null && focused !== null) {
      const { clip, link } = focused;
      const paths = clip.tracks.map(({ path }) => path);
      this.#clip = {
        clip,
        bound: boundBlocks(bindTracks(paths, link, this.#options.document.tree))
      };
    }

    return this.#clip;
  }

  #poses(): Map<string, BlockTransformJSON> {
    const { session } = this.#options;
    const { tick } = session.playback;
    const poses = new Map<string, BlockTransformJSON>();
    const posed = session.active ? this.#posedClip() : null;
    if (posed === null) {
      return poses;
    }

    const { tree } = this.#options.document;
    const samples = sampleClip(posed.clip, tick);
    for (const [path, blockId] of posed.bound) {
      const rest = tree.block(blockId)?.transform;
      const sample = samples.get(path);
      if (rest !== undefined && sample !== undefined) {
        poses.set(blockId, poseBlock(rest, sample));
      }
    }

    return poses;
  }

  #pose(
    poses: ReadonlyMap<string, BlockTransformJSON>
  ): void {
    const { document, blocks, requestFrame } = this.#options;
    for (const blockId of this.#posed) {
      const rest = document.tree.block(blockId)?.transform;
      if (!poses.has(blockId) && rest !== undefined) {
        blocks.applyTransform(blockId, rest);
      }
    }
    for (const [blockId, transform] of poses) {
      blocks.applyTransform(blockId, transform);
    }
    if (this.#posed.size > 0 || poses.size > 0) {
      requestFrame();
    }
    this.#posed = new Set(poses.keys());
  }
}
