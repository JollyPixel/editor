// Import Third-party Dependencies
import type {
  Keyboard,
  KeyBindingHandler,
  KeyChordString
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { MapPlacement } from "./MapPlacement.ts";
import { PLACEMENT_ROTATIONS } from "./placementTransforms.ts";

export const PLACEMENT_SHORTCUTS = {
  commit: ["Enter", "NumpadEnter"],
  cancel: ["Escape"]
} as const satisfies Record<string, readonly KeyChordString[]>;

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

  const { commit, cancel } = PLACEMENT_SHORTCUTS;
  const releases = [
    ...PLACEMENT_ROTATIONS.map(({ chords, transform }) => keyboard.bind(
      chords,
      whilePlacing(() => {
        placement.store.transform(transform);
      })
    )),
    keyboard.bind(commit, whilePlacing((event) => {
      if (pressesButton(event)) {
        return false;
      }
      placement.commit();

      return true;
    })),
    keyboard.bind(cancel, () => placement.cancel(), { priority: 1 })
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
