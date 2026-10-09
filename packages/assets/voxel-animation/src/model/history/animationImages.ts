// Import Internal Dependencies
import type {
  AnimationClipJSON,
  AnimationCommand,
  AnimationSetSnapshot
} from "../../network/types.ts";
import type { AnimationSetReader } from "../AnimationSet.ts";

export interface AnimationImage {
  readonly rig: string;
  readonly order: readonly string[];
  readonly clips: ReadonlyMap<string, AnimationClipJSON | undefined>;
}

export function imageOf(
  set: AnimationSetReader,
  command: AnimationCommand
): AnimationImage {
  const touched = touchedClip(command);

  return {
    rig: set.rig,
    order: [...set.clips()].map(({ id }) => id),
    clips: new Map(touched === null ? [] : [[touched, set.clip(touched)]])
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
    for (const [id, clip] of image.clips) {
      if (clip === undefined) {
        clips.delete(id);
      }
      else {
        clips.set(id, clip);
      }
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

function touchedClip(
  command: AnimationCommand
): string | null {
  switch (command.action) {
    case "rig-renamed":
      return null;
    case "clip-added":
      return command.clip.id;
    case "clip-removed":
    case "clip-changed":
    case "clip-moved":
      return command.id;
    case "key-set":
    case "key-removed":
    case "track-removed":
    case "track-renamed":
      return command.clipId;
  }
}
