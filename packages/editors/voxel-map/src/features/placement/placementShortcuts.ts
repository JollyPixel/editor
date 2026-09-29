// Import Internal Dependencies
import type { MapPlacement } from "./MapPlacement.ts";
import {
  bindKeys,
  type KeyBindingTarget
} from "../../shared/keyBindings.ts";

export interface PlacementShortcutsOptions {
  keyboard: KeyBindingTarget;
  placement: Pick<MapPlacement, "store" | "commit">;
}

export function bindPlacementShortcuts(
  options: PlacementShortcutsOptions
): () => void {
  const { placement } = options;
  const codes = ["KeyQ", "KeyE", "Enter", "NumpadEnter"] as const;

  return bindKeys(options.keyboard, codes, (event) => {
    if (
      !placement.store.placing ||
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.metaKey
    ) {
      return;
    }

    switch (event.code) {
      case "KeyQ":
        placement.store.transform({ rotation: 1 });
        break;
      case "KeyE":
        placement.store.transform({ rotation: 3 });
        break;
      default:
        if (pressesButton(event)) {
          return;
        }
        placement.commit();
        break;
    }

    event.preventDefault();
  });
}

function pressesButton(
  event: KeyboardEvent
): boolean {
  return event.composedPath().some(
    (target) => target instanceof HTMLButtonElement
  );
}
