// Import Third-party Dependencies
import {
  CommandDocument,
  type CommandChange,
  type CommandState
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type {
  AnimationChannel,
  AnimationClipPatchJSON,
  AnimationCommand,
  AnimationKeyJSON,
  AnimationLoop,
  AnimationSetSnapshot,
  AnimationTrackJSON
} from "../network/types.ts";
import {
  AnimationSet,
  type AnimationSetReader
} from "./AnimationSet.ts";
import {
  imageOf,
  restoreImages,
  type AnimationImage
} from "./animationImages.ts";
import { inverseOf } from "./animationInverse.ts";
import { TICKS_PER_SECOND } from "./ticks.ts";

// CONSTANTS
const kDefaultFps = 24;

export type { AnimationImage };

export type AnimationChange = CommandChange<AnimationCommand, AnimationImage>;

export interface AddClipOptions {
  name: string;
  id?: string;
  /** In ticks; one second by default. */
  length?: number;
  /** @default 24 */
  fps?: number;
  /** @default "loop" */
  loop?: AnimationLoop;
  tracks?: readonly AnimationTrackJSON[];
  /** The clip to land before; last when omitted. */
  beforeId?: string;
}

export class AnimationDocument extends CommandDocument<
  AnimationCommand,
  AnimationSetSnapshot,
  AnimationImage
> {
  readonly set: AnimationSetReader;

  constructor() {
    const set = new AnimationSet();
    super(animationState(set));
    this.set = set;
  }

  renameRig(
    rig: string
  ): boolean {
    return this.commit({ action: "rig-renamed", rig });
  }

  addClip(
    options: AddClipOptions
  ): string | null {
    const {
      id = crypto.randomUUID(),
      name,
      length = TICKS_PER_SECOND,
      fps = kDefaultFps,
      loop = "loop",
      tracks = [],
      beforeId
    } = options;
    const added = this.commit({
      action: "clip-added",
      clip: {
        id,
        name,
        length,
        fps,
        loop,
        tracks: structuredClone([...tracks])
      },
      ...(beforeId === undefined ? {} : { beforeId })
    });

    return added ? id : null;
  }

  removeClip(
    id: string
  ): boolean {
    return this.commit({ action: "clip-removed", id });
  }

  changeClip(
    id: string,
    patch: AnimationClipPatchJSON
  ): boolean {
    return this.commit({ action: "clip-changed", id, patch });
  }

  moveClip(
    id: string,
    beforeId?: string
  ): boolean {
    return this.commit({
      action: "clip-moved",
      id,
      ...(beforeId === undefined ? {} : { beforeId })
    });
  }

  setKey(
    clipId: string,
    path: string,
    channel: AnimationChannel,
    key: AnimationKeyJSON
  ): boolean {
    return this.commit({ action: "key-set", clipId, path, channel, key });
  }

  removeKey(
    clipId: string,
    path: string,
    channel: AnimationChannel,
    tick: number
  ): boolean {
    return this.commit({ action: "key-removed", clipId, path, channel, tick });
  }

  removeTrack(
    clipId: string,
    path: string
  ): boolean {
    return this.commit({ action: "track-removed", clipId, path });
  }

  renameTrack(
    clipId: string,
    path: string,
    to: string
  ): boolean {
    return this.commit({ action: "track-renamed", clipId, path, to });
  }
}

function animationState(
  set: AnimationSet
): CommandState<AnimationCommand, AnimationSetSnapshot, AnimationImage> {
  return {
    accepts: (command) => set.accepts(command),
    placeable: (command) => set.placeable(command),
    apply: (command) => set.apply(command),
    load: (snapshot) => set.load(snapshot),
    imageOf: (command) => imageOf(set, command),
    inverseOf: (command) => inverseOf(set, command),
    restored: (images) => restoreImages(set.toJSON(), images)
  };
}
