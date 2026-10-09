// Import Third-party Dependencies
import {
  KeyedGuard,
  type HistoryKeys,
  type KeyedGuardEntry
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type { AnimationImage } from "./animationImages.ts";
import type { AnimationSetReader } from "../AnimationSet.ts";
import type { AnimationCommand } from "../../network/types.ts";
import {
  animationConflictKeys,
  animationConflictRefs,
  animationValueKey,
  type AnimationValueRef
} from "../../network/AnimationCommandKeys.ts";

export function animationHistoryKeys(
  set: AnimationSetReader
): HistoryKeys<AnimationCommand, AnimationImage> {
  return {
    written: ({ command }) => [
      ...animationConflictKeys(command),
      ...contentKeysOf(command)
    ],
    guard: (commands) => new KeyedGuard(commands.flatMap((command) => [
      ...animationConflictRefs(command).map((ref): KeyedGuardEntry => {
        return {
          key: animationValueKey(ref),
          read: () => valueOf(set, ref)
        };
      }),
      ...command.action === "clip-removed" ?
        [{ key: clipContentKey(command.id), read: () => set.clip(command.id)?.tracks }] :
        []
    ]))
  };
}

function valueOf(
  set: AnimationSetReader,
  ref: AnimationValueRef
): unknown {
  switch (ref.kind) {
    case "rig":
      return set.rig;
    case "clip":
      return Reflect.get(set.clip(ref.clipId) ?? {}, ref.field);
    case "clip-order":
      return set.has(ref.clipId) ? set.nextClipOf(ref.clipId) ?? null : undefined;
    case "key":
      return set.keyAt(ref.clipId, ref.path, ref.channel, ref.tick);
  }
}

function contentKeysOf(
  command: AnimationCommand
): string[] {
  switch (command.action) {
    case "key-set":
    case "key-removed":
    case "track-removed":
    case "track-renamed":
      return [clipContentKey(command.clipId)];
    case "rig-renamed":
    case "clip-added":
    case "clip-removed":
    case "clip-changed":
    case "clip-moved":
      return [];
  }
}

function clipContentKey(
  clipId: string
): string {
  return `clip-content:${clipId}`;
}
