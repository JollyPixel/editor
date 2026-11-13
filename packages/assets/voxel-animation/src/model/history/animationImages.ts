// Import Internal Dependencies
import type {
  AnimationClipJSON,
  AnimationCommand,
  AnimationSetSnapshot
} from "../../network/types.ts";
import type { AnimationSetReader } from "../AnimationSet.ts";
import { animationFootprint } from "../command/animationCommands.ts";

export interface AnimationClipImage {
  readonly id: string;
  readonly before: AnimationClipJSON | undefined;
}

export interface AnimationImage {
  readonly rig: string;
  readonly order: readonly string[];
  readonly clip: AnimationClipImage | null;
}

export function captureImage(
  set: AnimationSetReader,
  command: AnimationCommand
): AnimationImage {
  const { clip } = animationFootprint(command);

  return {
    rig: set.rig,
    order: [...set.clipIds()],
    clip: clip === null ?
      null :
      {
        id: clip.id,
        before: set.clip(clip.id)?.toJSON()
      }
  };
}

export function restoreImages(
  snapshot: AnimationSetSnapshot,
  images: readonly AnimationImage[]
): AnimationSetSnapshot {
  const clips = new Map(snapshot.clips.map((clip) => [clip.id, clip]));
  let { rig } = snapshot;
  let order = snapshot.clips.map(({ id }) => id);
  for (const image of [...images].reverse()) {
    rig = image.rig;
    order = [...image.order];
    if (image.clip === null) {
      continue;
    }

    const { id, before } = image.clip;
    if (before === undefined) {
      clips.delete(id);
    }
    else {
      clips.set(id, before);
    }
  }

  return {
    rig,
    clips: order.flatMap((id) => {
      const clip = clips.get(id);

      return clip === undefined ? [] : [structuredClone(clip)];
    })
  };
}
