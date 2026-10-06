// Import Third-party Dependencies
import {
  KeyChord,
  type Keyboard,
  type KeyChordString
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { AnimationKeyer } from "./AnimationKeyer.ts";
import type { BlockSelectionStore } from "../../state/index.ts";

export const KEY_BLOCK_SHORTCUT = ["k"] as const satisfies readonly KeyChordString[];

export interface KeySelectedOptions {
  keyer: Pick<AnimationKeyer, "keyBlock">;
  selection: Pick<BlockSelectionStore, "selected">;
}

export interface AnimationShortcutsOptions extends KeySelectedOptions {
  keyboard: Pick<Keyboard, "bind">;
}

export function keyBlockShortcutLabel(): string {
  return KeyChord.parse(KEY_BLOCK_SHORTCUT[0]).format();
}

export function keySelectedBlock(
  options: KeySelectedOptions
): boolean {
  const { selected } = options.selection;

  return selected !== null && options.keyer.keyBlock(selected);
}

export function bindAnimationShortcuts(
  options: AnimationShortcutsOptions
): () => void {
  return options.keyboard.bind(KEY_BLOCK_SHORTCUT, () => {
    keySelectedBlock(options);
  });
}
