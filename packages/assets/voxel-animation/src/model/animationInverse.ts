// Import Internal Dependencies
import type {
  AnimationClipJSON,
  AnimationClipPatchJSON,
  AnimationCommand
} from "../network/types.ts";
import { ANIMATION_CHANNELS } from "../network/AnimationCommand.schema.ts";
import type { AnimationSetReader } from "./AnimationSet.ts";
import { trackOf } from "./clipTracks.ts";
import { InvalidAnimationSetError } from "./InvalidAnimationSetError.ts";

export function inverseOf(
  set: AnimationSetReader,
  command: AnimationCommand
): AnimationCommand[] {
  switch (command.action) {
    case "rig-renamed":
      return [{ action: "rig-renamed", rig: set.rig }];

    case "clip-added":
      return [{ action: "clip-removed", id: command.clip.id }];

    case "clip-removed":
      return [{
        action: "clip-added",
        clip: existingClip(set, command.id),
        ...withBefore(set.nextClipOf(command.id))
      }];

    case "clip-changed":
      return [{
        action: "clip-changed",
        id: command.id,
        patch: previousPatch(existingClip(set, command.id), command.patch)
      }];

    case "clip-moved":
      return [{
        action: "clip-moved",
        id: command.id,
        ...withBefore(set.nextClipOf(command.id))
      }];

    case "key-set": {
      const { clipId, path, channel, key } = command;
      const previous = set.keyAt(clipId, path, channel, key.tick);

      return previous === undefined ?
        [{ action: "key-removed", clipId, path, channel, tick: key.tick }] :
        [{ action: "key-set", clipId, path, channel, key: previous }];
    }

    case "key-removed": {
      const { clipId, path, channel, tick } = command;
      const key = set.keyAt(clipId, path, channel, tick);
      if (key === undefined) {
        throw new InvalidAnimationSetError(clipId, `has no ${channel} key at ${tick} on ${path}`);
      }

      return [{ action: "key-set", clipId, path, channel, key }];
    }

    case "track-removed": {
      const { clipId, path } = command;
      const track = trackOf(existingClip(set, clipId), path);
      if (track === undefined) {
        throw new InvalidAnimationSetError(clipId, `has no track ${path}`);
      }

      return ANIMATION_CHANNELS.flatMap((channel) => (track[channel] ?? []).map(
        (key): AnimationCommand => {
          return { action: "key-set", clipId, path, channel, key };
        }
      ));
    }

    case "track-renamed": {
      const { clipId, path, to } = command;
      const track = trackOf(existingClip(set, clipId), path);
      if (track === undefined) {
        throw new InvalidAnimationSetError(clipId, `has no track ${path}`);
      }

      return [{ action: "track-renamed", clipId, path: to, to: track.path }];
    }
  }
}

function existingClip(
  set: AnimationSetReader,
  clipId: string
): AnimationClipJSON {
  const clip = set.clip(clipId);
  if (clip === undefined) {
    throw new InvalidAnimationSetError(clipId, "is missing for a command the set accepted");
  }

  return clip;
}

function previousPatch(
  clip: AnimationClipJSON,
  patch: AnimationClipPatchJSON
): AnimationClipPatchJSON {
  return {
    ...patch.name === undefined ? {} : { name: clip.name },
    ...patch.length === undefined ? {} : { length: clip.length },
    ...patch.fps === undefined ? {} : { fps: clip.fps },
    ...patch.loop === undefined ? {} : { loop: clip.loop }
  };
}

function withBefore(
  beforeId: string | undefined
): { beforeId?: string; } {
  return beforeId === undefined ? {} : { beforeId };
}
