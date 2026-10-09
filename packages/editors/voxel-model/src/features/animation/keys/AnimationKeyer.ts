// Import Third-party Dependencies
import {
  ANIMATION_CHANNELS,
  sampleClip,
  snapToFrame,
  type AnimationSample,
  type Vector3JSON
} from "@jolly-pixel/asset.voxel-animation/client";
import {
  poseDelta,
  trackPathOf,
  type BlockTransformJSON,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { AnimationPoser } from "../session/AnimationPoser.ts";
import type { AnimationSession } from "../session/AnimationSession.ts";
import type { ScopeRecorder } from "../../history/index.ts";
import type { ModelBlock } from "../../../scene/index.ts";
import type { ClipKey } from "../../../state/index.ts";
import type {
  TransformMode,
  TransformTarget
} from "../../transform/index.ts";

// CONSTANTS
const kAnimatedModes: readonly TransformMode[] = ["pos", "angle", "scale"];
const kKeyDecimals = 4;
const kRestSample: Required<AnimationSample> = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 }
};

export interface AnimationKeyerOptions {
  document: ModelDocument;
  history: ScopeRecorder<ClipKey>;
  blocks: {
    get(id: string): PosedBlock | undefined;
  };
  session: Pick<AnimationSession, "focused" | "playback" | "active">;
  poser: Pick<AnimationPoser, "reset">;
}

type PosedBlock = Pick<ModelBlock, "uuid" | "transform">;

type KeyedChannels = "changed" | "all";

export class AnimationKeyer implements TransformTarget {
  readonly modes = kAnimatedModes;

  #options: AnimationKeyerOptions;

  constructor(
    options: AnimationKeyerOptions
  ) {
    this.#options = options;
  }

  end(
    block: PosedBlock
  ): void {
    this.commit(block);
  }

  commit(
    block: PosedBlock
  ): void {
    if (!this.#key(block.uuid, block.transform, "changed")) {
      this.#options.poser.reset(block.uuid);
    }
  }

  keyBlock(
    blockId: string
  ): boolean {
    const block = this.#options.blocks.get(blockId);

    return this.#options.session.active &&
      block !== undefined &&
      this.#key(blockId, block.transform, "all");
  }

  #key(
    blockId: string,
    pose: BlockTransformJSON,
    channels: KeyedChannels
  ): boolean {
    const { document: { tree }, session } = this.#options;
    const { focused } = session;
    const rest = tree.block(blockId)?.transform;
    if (focused === null || rest === undefined) {
      return false;
    }

    const { key, set, link, clip } = focused;
    const path = trackPathOf(link, tree, blockId, clip.tracks.map((track) => track.path));
    const { tick } = session.playback;
    const shown = { ...kRestSample, ...sampleClip(clip, tick).get(path) };
    const delta = poseDelta(rest, pose);
    const frameTick = Math.min(snapToFrame(tick, clip.fps), clip.length);

    return this.#options.history.record(key, `Key ${tree.get(blockId)?.name ?? ""}`, () => {
      let keyed = false;
      for (const channel of ANIMATION_CHANNELS) {
        const value = rounded(delta[channel]);
        if (channels === "all" || !sameVector(value, rounded(shown[channel]))) {
          const current = set.document.set.keyAt(clip.id, path, channel, frameTick);
          const key = {
            tick: frameTick,
            value,
            interpolation: current?.interpolation ?? "linear"
          };
          keyed = set.document.setKey(clip.id, path, channel, key) || keyed;
        }
      }

      return keyed;
    });
  }
}

function rounded(
  value: Vector3JSON
): Vector3JSON {
  return {
    x: Number(value.x.toFixed(kKeyDecimals)),
    y: Number(value.y.toFixed(kKeyDecimals)),
    z: Number(value.z.toFixed(kKeyDecimals))
  };
}

function sameVector(
  a: Vector3JSON,
  b: Vector3JSON
): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
