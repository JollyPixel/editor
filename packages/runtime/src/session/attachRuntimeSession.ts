// Import Third-party Dependencies
import {
  suspendWhenHidden,
  type GameLoop
} from "@jolly-pixel/loop";

// Import Internal Dependencies
import type { GamepadPoller } from "../contract/RuntimeBackend.ts";
import type { OverlayLayer } from "../overlay/OverlayLayer.ts";
import { mountFocusHint } from "./mountFocusHint.ts";
import { watchPageActivity } from "./watchPageActivity.ts";
import { watchGamepadActivity } from "./watchGamepadActivity.ts";
import type { RuntimeSessionSettings } from "./RuntimeSessionSettings.ts";

export interface RuntimeSessionHost {
  readonly canvas: HTMLCanvasElement;
  readonly overlay: OverlayLayer;
  readonly loop: GameLoop;
  readonly world: {
    readonly input: {
      readonly gamepad: GamepadPoller;
    };
  };

  nextFrame(): Promise<void>;
}

export function attachRuntimeSession(
  host: RuntimeSessionHost,
  settings: RuntimeSessionSettings,
  signal: AbortSignal
): void {
  const { canvas, overlay, loop } = host;

  canvas.focus();
  canvas.addEventListener(
    "keypress",
    (event) => event.preventDefault(),
    { signal }
  );

  if (settings.focusCanvas) {
    canvas.ownerDocument.addEventListener(
      "click",
      () => {
        if (canvas.ownerDocument.activeElement !== canvas) {
          canvas.focus();
        }
      },
      { signal }
    );
  }

  if (settings.focusHint !== null) {
    mountFocusHint(
      canvas,
      overlay,
      settings.focusHint,
      signal
    );
  }

  if (settings.renderOnDemand) {
    watchPageActivity(
      canvas,
      () => loop.invalidate(),
      signal
    );
    const view = canvas.ownerDocument.defaultView;
    if (view !== null) {
      watchGamepadActivity(
        host.world.input.gamepad,
        loop,
        view,
        signal
      );
    }
  }

  if (settings.suspendWhenHidden) {
    void host.nextFrame().then(() => {
      if (!signal.aborted) {
        suspendWhenHidden(
          loop,
          canvas,
          signal
        );
      }
    });
  }
}
