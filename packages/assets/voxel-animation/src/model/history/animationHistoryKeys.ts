// Import Third-party Dependencies
import {
  KeyedGuard,
  type HistoryKeys,
  type KeyedGuardEntry
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type { AnimationImage } from "./animationImages.ts";
import type { AnimationSetReader } from "../AnimationSet.ts";
import { animationFootprint } from "../command/animationCommands.ts";
import type { AnimationCommand } from "../../network/types.ts";

export function animationHistoryKeys(
  set: AnimationSetReader
): HistoryKeys<AnimationCommand, AnimationImage> {
  return {
    written: ({ command }) => animationFootprint(command).written.map((ref) => ref.key),
    guard: (commands) => new KeyedGuard(commands.flatMap(
      (command) => animationFootprint(command).guarded.map((ref): KeyedGuardEntry => {
        return {
          key: ref.key,
          read: () => ref.read(set)
        };
      })
    ))
  };
}
