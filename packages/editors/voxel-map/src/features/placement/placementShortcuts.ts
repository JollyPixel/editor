// Import Third-party Dependencies
import type {
  Keyboard,
  KeyBindingHandler
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { MapPlacement } from "./MapPlacement.ts";

export interface PlacementShortcutsOptions {
  keyboard: Pick<Keyboard, "bind">;
  placement: Pick<MapPlacement, "store" | "commit" | "cancel">;
}

export function bindPlacementShortcuts(
  options: PlacementShortcutsOptions
): () => void {
  const { keyboard, placement } = options;

  function whilePlacing(
    action: (event: KeyboardEvent) => boolean | void
  ): KeyBindingHandler {
    return (event) => placement.store.placing && action(event) !== false;
  }

  const releases = [
    keyboard.bind("KeyQ", whilePlacing(() => {
      placement.store.transform({ rotation: 1 });
    })),
    keyboard.bind("KeyE", whilePlacing(() => {
      placement.store.transform({ rotation: 3 });
    })),
    keyboard.bind(["Enter", "NumpadEnter"], whilePlacing((event) => {
      if (pressesButton(event)) {
        return false;
      }
      placement.commit();

      return true;
    })),
    keyboard.bind("Escape", () => placement.cancel(), { priority: 1 })
  ];

  return () => {
    for (const release of releases) {
      release();
    }
  };
}

function pressesButton(
  event: KeyboardEvent
): boolean {
  return event.composedPath().some(
    (target) => target instanceof HTMLButtonElement
  );
}
