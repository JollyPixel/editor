// Import Third-party Dependencies
import type {
  Keyboard,
  KeyCode
} from "@jolly-pixel/controls";

export type KeyBindingTarget = Pick<Keyboard, "on" | "off">;

export function bindKeys(
  keyboard: KeyBindingTarget,
  codes: readonly KeyCode[],
  listener: (event: KeyboardEvent) => void
): () => void {
  for (const code of codes) {
    keyboard.on(code, listener);
  }

  return () => {
    for (const code of codes) {
      keyboard.off(code, listener);
    }
  };
}
