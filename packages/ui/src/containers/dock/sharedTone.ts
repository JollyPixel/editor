// Import Internal Dependencies
import type { IconTone } from "../../icon/registry.ts";

export interface TonedPane {
  readonly ownTone: IconTone | null;
}

export interface TonedGroup {
  activePane(): TonedPane | null;
}

export type TonedSlot = TonedPane | TonedGroup;

export function sharedAreaTone(
  slots: Iterable<TonedSlot>
): IconTone | null {
  for (const slot of slots) {
    const pane = "activePane" in slot ? slot.activePane() : slot;
    const tone = pane?.ownTone ?? null;
    if (tone !== null) {
      return tone;
    }
  }

  return null;
}
