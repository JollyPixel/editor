// Import Internal Dependencies
import type { AnimationSetReader } from "../AnimationSet.ts";
import { TrackPath } from "../values/TrackPath.ts";
import type {
  AnimationChannel,
  AnimationClipPatchJSON
} from "../../network/types.ts";

export type AnimationClipField = keyof AnimationClipPatchJSON;

type ValueReader = (set: AnimationSetReader) => unknown;

export class AnimationValueRef {
  static rig(): AnimationValueRef {
    return new AnimationValueRef("rig", (set) => set.rig);
  }

  static clipField(
    clipId: string,
    field: AnimationClipField
  ): AnimationValueRef {
    return new AnimationValueRef(
      `clip:${clipId}:${field}`,
      (set) => set.clip(clipId)?.settings()[field]
    );
  }

  static clipOrder(
    clipId: string
  ): AnimationValueRef {
    return new AnimationValueRef(
      `clip-order:${clipId}`,
      (set) => (set.has(clipId) ? set.nextClipAfter(clipId) ?? null : undefined)
    );
  }

  static clipContent(
    clipId: string
  ): AnimationValueRef {
    return new AnimationValueRef(
      `clip-content:${clipId}`,
      (set) => set.clip(clipId)?.toJSON().tracks
    );
  }

  static key(
    clipId: string,
    path: string,
    channel: AnimationChannel,
    tick: number
  ): AnimationValueRef {
    return new AnimationValueRef(
      `key:${clipId}:${new TrackPath(path).key}:${channel}:${tick}`,
      (set) => set.clip(clipId)?.keyAt(path, channel, tick)
    );
  }

  readonly key: string;
  readonly #read: ValueReader;

  constructor(
    key: string,
    read: ValueReader
  ) {
    this.key = key;
    this.#read = read;
  }

  read(
    set: AnimationSetReader
  ): unknown {
    return this.#read(set);
  }
}
