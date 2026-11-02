// Import Third-party Dependencies
import {
  KeyedGuard,
  type HistoryKeys,
  type KeyedGuardEntry
} from "@jolly-pixel/history";

// Import Internal Dependencies
import { SceneFootprint } from "../footprint/SceneFootprint.ts";
import type { SceneTreeReader } from "../tree/SceneTree.ts";
import type { SceneImage } from "./sceneImages.ts";
import type { SceneCommand } from "../../network/types.ts";

export function sceneHistoryKeys(
  tree: SceneTreeReader
): HistoryKeys<SceneCommand, SceneImage> {
  return {
    written: ({ image }) => [...new Set(
      image.before.writtenRefs(tree).map((ref) => ref.key)
    )],
    guard: (commands) => new KeyedGuard(commands.flatMap(
      (command) => SceneFootprint.capture(tree, command).guardRefs().map(
        (ref): KeyedGuardEntry => {
          return {
            key: ref.key,
            read: () => ref.read(tree)
          };
        }
      )
    ))
  };
}
