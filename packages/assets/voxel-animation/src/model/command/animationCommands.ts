// Import Third-party Dependencies
import {
  InvalidEntryError,
  withBefore
} from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type {
  AnimationClipPatchJSON,
  AnimationCommand,
  AnimationCommandAction
} from "../../network/types.ts";
import { AnimationClip } from "../AnimationClip.ts";
import type { AnimationChange } from "../AnimationDocument.ts";
import type { AnimationSetReader } from "../AnimationSet.ts";
import type { AnimationTrack } from "../AnimationTrack.ts";
import { TrackPath } from "../values/TrackPath.ts";
import {
  AnimationValueRef,
  type AnimationClipField
} from "./AnimationValueRef.ts";

// CONSTANTS
const kClipFields: readonly AnimationClipField[] = [
  "name",
  "length",
  "fps",
  "loop"
];

export interface AnimationCommandClip {
  readonly id: string;
  readonly content: boolean;
}

export interface AnimationFootprint {
  readonly clip: AnimationCommandClip | null;
  readonly writes: readonly AnimationValueRef[] | null;
  readonly conflicts: readonly AnimationValueRef[];
  readonly written: readonly AnimationValueRef[];
  readonly guarded: readonly AnimationValueRef[];
}

interface AnimationCommandSpec<TCommand extends AnimationCommand> {
  accepts(set: AnimationSetReader, command: TCommand): boolean;
  placed?(set: AnimationSetReader, command: TCommand): AnimationCommand;
  clip(command: TCommand): AnimationCommandClip | null;
  writes(command: TCommand): AnimationValueRef[] | null;
  conflicts?(command: TCommand): AnimationValueRef[];
  guards?(command: TCommand): AnimationValueRef[];
  invert(set: AnimationSetReader, command: TCommand): AnimationCommand[];
  label(command: TCommand, clipName: string): string;
}

type AnimationCommandSpecs = {
  [TAction in AnimationCommandAction]: AnimationCommandSpec<
    Extract<AnimationCommand, { action: TAction; }>
  >;
};

const kAnimationCommands: AnimationCommandSpecs = {
  "rig-renamed": {
    accepts: () => true,
    clip: () => null,
    writes: () => [AnimationValueRef.rig()],
    invert: (set) => [{ action: "rig-renamed", rig: set.rig }],
    label: () => "Rename rig"
  },
  "clip-added": {
    accepts: (set, { clip, beforeId }) => !set.has(clip.id) &&
      AnimationClip.findProblem(clip) === null &&
      set.canPlace(clip.id, beforeId),
    placed: (set, command) => placedBefore(set, command.clip.id, command),
    clip: ({ clip }) => clipTarget(clip.id),
    writes: () => null,
    invert: (_set, { clip }) => [{ action: "clip-removed", id: clip.id }],
    label: ({ clip }) => `Add clip ${clip.name}`
  },
  "clip-removed": {
    accepts: (set, { id }) => set.has(id),
    clip: ({ id }) => clipTarget(id),
    writes: () => null,
    conflicts: ({ id }) => [
      AnimationValueRef.clipOrder(id),
      ...clipFieldRefs(id, kClipFields)
    ],
    guards: ({ id }) => [AnimationValueRef.clipContent(id)],
    invert: (set, { id }) => [{
      action: "clip-added",
      clip: existingClip(set, id).toJSON(),
      ...withBefore(set.nextClipAfter(id))
    }],
    label: (_command, clipName) => `Delete clip ${clipName}`
  },
  "clip-changed": {
    accepts: (set, { id, patch }) => set.clip(id)?.canPatch(patch) ?? false,
    clip: ({ id }) => clipTarget(id),
    writes: ({ id, patch }) => clipFieldRefs(id, patchedFields(patch)),
    invert: (set, { id, patch }) => [{
      action: "clip-changed",
      id,
      patch: existingClip(set, id).restoringPatch(patch)
    }],
    label: ({ patch }, clipName) => `${patch.name === undefined ? "Edit" : "Rename"} clip ${clipName}`
  },
  "clip-moved": {
    accepts: (set, { id, beforeId }) => set.has(id) && set.canPlace(id, beforeId),
    placed: (set, command) => placedBefore(set, command.id, command),
    clip: ({ id }) => clipTarget(id),
    writes: () => null,
    conflicts: ({ id }) => [AnimationValueRef.clipOrder(id)],
    invert: (set, { id }) => [{
      action: "clip-moved",
      id,
      ...withBefore(set.nextClipAfter(id))
    }],
    label: (_command, clipName) => `Move clip ${clipName}`
  },
  "key-set": {
    accepts: (set, { clipId }) => set.has(clipId),
    clip: ({ clipId }) => contentTarget(clipId),
    writes: ({ clipId, path, channel, key }) => [
      AnimationValueRef.key(clipId, path, channel, key.tick)
    ],
    invert: (set, { clipId, path, channel, key }) => {
      const previous = set.clip(clipId)?.keyAt(path, channel, key.tick);

      return previous === undefined ?
        [{ action: "key-removed", clipId, path, channel, tick: key.tick }] :
        [{ action: "key-set", clipId, path, channel, key: previous }];
    },
    label: ({ path }) => `Key ${new TrackPath(path).blockName}`
  },
  "key-removed": {
    accepts: (set, { clipId, path, channel, tick }) => (
      set.clip(clipId)?.keyAt(path, channel, tick) !== undefined
    ),
    clip: ({ clipId }) => contentTarget(clipId),
    writes: ({ clipId, path, channel, tick }) => [
      AnimationValueRef.key(clipId, path, channel, tick)
    ],
    invert: (set, { clipId, path, channel, tick }) => {
      const key = set.clip(clipId)?.keyAt(path, channel, tick);
      if (key === undefined) {
        throw new InvalidEntryError("clip", clipId, `has no ${channel} key at ${tick} on ${path}`);
      }

      return [{ action: "key-set", clipId, path, channel, key }];
    },
    label: ({ path }) => `Delete key of ${new TrackPath(path).blockName}`
  },
  "track-removed": {
    accepts: (set, { clipId, path }) => set.clip(clipId)?.hasTrack(path) ?? false,
    clip: ({ clipId }) => contentTarget(clipId),
    writes: () => null,
    invert: (set, { clipId, path }) => [...existingTrack(set, clipId, path).keys()].map(
      ([channel, key]): AnimationCommand => {
        return { action: "key-set", clipId, path, channel, key };
      }
    ),
    label: ({ path }) => `Delete track ${new TrackPath(path).blockName}`
  },
  "track-renamed": {
    accepts: (set, { clipId, path, to }) => set.clip(clipId)?.canRenameTrack(path, to) ?? false,
    clip: ({ clipId }) => contentTarget(clipId),
    writes: () => null,
    invert: (set, { clipId, path, to }) => [{
      action: "track-renamed",
      clipId,
      path: to,
      to: existingTrack(set, clipId, path).path
    }],
    label: ({ path }) => `Rename track ${new TrackPath(path).blockName}`
  }
};

export function acceptsAnimationCommand(
  set: AnimationSetReader,
  command: AnimationCommand
): boolean {
  return commandSpec(command).accepts(set, command);
}

export function placeAnimationCommand(
  set: AnimationSetReader,
  command: AnimationCommand
): AnimationCommand {
  return commandSpec(command).placed?.(set, command) ?? command;
}

export function animationFootprint(
  command: AnimationCommand
): AnimationFootprint {
  const spec = commandSpec(command);
  const clip = spec.clip(command);
  const writes = spec.writes(command);
  const conflicts = spec.conflicts?.(command) ?? writes ?? [];

  return {
    clip,
    writes,
    conflicts,
    written: clip?.content === true ?
      [...conflicts, AnimationValueRef.clipContent(clip.id)] :
      conflicts,
    guarded: [...conflicts, ...spec.guards?.(command) ?? []]
  };
}

export function invertAnimationCommand(
  set: AnimationSetReader,
  command: AnimationCommand
): AnimationCommand[] {
  return commandSpec(command).invert(set, command);
}

export function animationChangeLabel(
  change: Pick<AnimationChange, "command" | "image">
): string {
  const { command, image } = change;

  return commandSpec(command).label(command, image.clip?.before?.name ?? "");
}

function commandSpec(
  command: AnimationCommand
): AnimationCommandSpec<AnimationCommand> {
  return kAnimationCommands[command.action];
}

function placedBefore<TCommand extends { beforeId?: string; }>(
  set: AnimationSetReader,
  clipId: string,
  command: TCommand
): Omit<TCommand, "beforeId"> {
  if (set.canPlace(clipId, command.beforeId)) {
    return command;
  }
  const { beforeId: _beforeId, ...placed } = command;

  return placed;
}

function clipTarget(
  id: string
): AnimationCommandClip {
  return {
    id,
    content: false
  };
}

function contentTarget(
  id: string
): AnimationCommandClip {
  return {
    id,
    content: true
  };
}

function patchedFields(
  patch: AnimationClipPatchJSON
): AnimationClipField[] {
  return kClipFields.filter((field) => patch[field] !== undefined);
}

function clipFieldRefs(
  clipId: string,
  fields: readonly AnimationClipField[]
): AnimationValueRef[] {
  return fields.map((field) => AnimationValueRef.clipField(clipId, field));
}

function existingClip(
  set: AnimationSetReader,
  clipId: string
): AnimationClip {
  const clip = set.clip(clipId);
  if (clip === undefined) {
    throw new InvalidEntryError("clip", clipId, "is missing for a command the set accepted");
  }

  return clip;
}

function existingTrack(
  set: AnimationSetReader,
  clipId: string,
  path: string
): AnimationTrack {
  const track = set.clip(clipId)?.track(path);
  if (track === undefined) {
    throw new InvalidEntryError("clip", clipId, `has no track ${path}`);
  }

  return track;
}
