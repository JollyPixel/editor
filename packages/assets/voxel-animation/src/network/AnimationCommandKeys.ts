// Import Internal Dependencies
import { TrackPath } from "../model/values/TrackPath.ts";
import type {
  AnimationChannel,
  AnimationClipPatchJSON,
  AnimationCommand,
  AnimationNetworkCommand
} from "./types.ts";

// CONSTANTS
const kClipFields = [
  "name",
  "length",
  "fps",
  "loop"
] as const satisfies readonly (keyof AnimationClipPatchJSON)[];

type KeyedCommand = AnimationCommand | AnimationNetworkCommand;

export type AnimationValueRef =
  | { kind: "rig"; }
  | { kind: "clip"; clipId: string; field: string; }
  | { kind: "clip-order"; clipId: string; }
  | { kind: "key"; clipId: string; path: string; channel: AnimationChannel; tick: number; };

export function animationValueKey(
  ref: AnimationValueRef
): string {
  switch (ref.kind) {
    case "rig":
      return "rig";
    case "clip":
      return `clip:${ref.clipId}:${ref.field}`;
    case "clip-order":
      return `clip-order:${ref.clipId}`;
    case "key":
      return `key:${ref.clipId}:${new TrackPath(ref.path).key}:${ref.channel}:${ref.tick}`;
  }
}

export function animationConflictRefs(
  command: KeyedCommand
): AnimationValueRef[] {
  switch (command.action) {
    case "clip-moved":
      return [{ kind: "clip-order", clipId: command.id }];
    case "clip-removed":
      return [{ kind: "clip-order", clipId: command.id }, ...clipFieldRefs(command.id, kClipFields)];
    case "rig-renamed":
    case "clip-changed":
    case "key-set":
    case "key-removed":
      return animationWriteRefs(command) ?? [];
    case "clip-added":
    case "track-removed":
    case "track-renamed":
      return [];
  }
}

export function animationWriteRefs(
  command: KeyedCommand
): AnimationValueRef[] | null {
  switch (command.action) {
    case "rig-renamed":
      return [{ kind: "rig" }];
    case "clip-changed":
      return clipFieldRefs(command.id, Object.keys(command.patch));
    case "key-set":
      return [keyRef(command.clipId, command.path, command.channel, command.key.tick)];
    case "key-removed":
      return [keyRef(command.clipId, command.path, command.channel, command.tick)];
    case "clip-added":
    case "clip-removed":
    case "clip-moved":
    case "track-removed":
    case "track-renamed":
      return null;
  }
}

export function animationConflictKeys(
  command: KeyedCommand
): string[] {
  return animationConflictRefs(command).map(animationValueKey);
}

export function animationWriteKeys(
  command: KeyedCommand
): string[] | null {
  return animationWriteRefs(command)?.map(animationValueKey) ?? null;
}

function clipFieldRefs(
  clipId: string,
  fields: readonly string[]
): AnimationValueRef[] {
  return fields.map((field) => {
    return { kind: "clip", clipId, field };
  });
}

function keyRef(
  clipId: string,
  path: string,
  channel: AnimationChannel,
  tick: number
): AnimationValueRef {
  return { kind: "key", clipId, path, channel, tick };
}
