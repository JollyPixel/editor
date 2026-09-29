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

export type KeyChainHandler = (event: KeyboardEvent) => boolean;

export function bindKeyChain(
  keyboard: KeyBindingTarget,
  code: KeyCode,
  handlers: readonly KeyChainHandler[]
): () => void {
  return bindKeys(keyboard, [code], (event) => {
    handlers.some((handler) => handler(event));
  });
}
