// Import Third-party Dependencies
import type { GameLoop } from "@jolly-pixel/loop";

// Import Internal Dependencies
import type { GamepadPoller } from "../contract/RuntimeBackend.ts";

export type GamepadActivityView = Pick<
  Window,
  "addEventListener" | "requestAnimationFrame" | "cancelAnimationFrame"
>;

export function watchGamepadActivity(
  gamepad: GamepadPoller,
  loop: Pick<GameLoop, "subscribe" | "invalidate">,
  view: GamepadActivityView,
  signal: AbortSignal
): void {
  let frame: number | null = null;

  function schedule(): void {
    frame ??= view.requestAnimationFrame(poll);
  }

  function cancel(): void {
    if (frame !== null) {
      view.cancelAnimationFrame(frame);
      frame = null;
    }
  }

  function poll(): void {
    frame = null;
    if (gamepad.connectedGamepads <= 0) {
      return;
    }

    gamepad.sample();
    if (gamepad.wasActive) {
      loop.invalidate();

      return;
    }

    schedule();
  }

  view.addEventListener(
    "gamepadconnected",
    () => loop.invalidate(),
    { signal }
  );
  const unsubscribes = [
    loop.subscribe("sleep", schedule),
    loop.subscribe("wake", cancel),
    loop.subscribe("stop", cancel)
  ];
  signal.addEventListener(
    "abort",
    () => {
      cancel();
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    },
    { once: true }
  );
}
