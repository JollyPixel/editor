// Import Third-party Dependencies
import { ClipSampler } from "@jolly-pixel/asset.voxel-animation/client";
import {
  BlockTransform,
  TrackBinding,
  type BlockTransformJSON,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { AnimationSession } from "./AnimationSession.ts";
import type { ModelBlocks } from "../../../scene/index.ts";
import { combineReleases } from "../../../shared/combineReleases.ts";

export interface AnimationPoserOptions {
  document: ModelDocument;
  blocks: Pick<ModelBlocks, "applyTransform">;
  session: AnimationSession;
  requestFrame(): void;
}

interface PosedClip {
  sampler: ClipSampler;
  bound: ReadonlyMap<string, string>;
}

export class AnimationPoser {
  #options: AnimationPoserOptions;
  #clip: PosedClip | null = null;
  #posed = new Set<string>();
  #release: () => void;

  constructor(
    options: AnimationPoserOptions
  ) {
    this.#options = options;
    this.#release = combineReleases([
      options.session.subscribe("clip", this.#onClip),
      options.session.subscribe("playhead", this.#update)
    ]);
    this.#onClip();
  }

  dispose(): void {
    this.#release();
    this.#pose(new Map());
  }

  shownTransform(
    blockId: string
  ): BlockTransformJSON | undefined {
    return this.#poses().get(blockId) ??
      this.#options.document.tree.block(blockId)?.transform;
  }

  reset(
    blockId: string
  ): void {
    const { blocks, requestFrame } = this.#options;
    const transform = this.shownTransform(blockId);
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
        sampler: new ClipSampler(clip),
        bound: new TrackBinding(paths, link, this.#options.document.tree).bound()
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
    const samples = posed.sampler.sample(tick);
    for (const [path, blockId] of posed.bound) {
      const rest = tree.block(blockId)?.transform;
      const sample = samples.get(path);
      if (rest !== undefined && sample !== undefined) {
        poses.set(blockId, new BlockTransform(rest).pose(sample));
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
