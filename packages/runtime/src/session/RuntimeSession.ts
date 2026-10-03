// Import Third-party Dependencies
import { suspendWhenHidden } from "@jolly-pixel/loop";

// Import Internal Dependencies
import type { Runtime } from "../Runtime.ts";
import { mountFocusHint } from "../ui/focus/mountFocusHint.ts";
import { mountViewHelper } from "../ui/viewHelper/mountViewHelper.ts";
import { PageActivity } from "./PageActivity.ts";
import {
  GamepadActivity,
  type GamepadPoller
} from "./GamepadActivity.ts";
import type { RuntimeSessionSettings } from "./RuntimeSessionSettings.ts";

export type RuntimeSessionHost = Pick<
  Runtime,
  "canvas" | "overlay" | "renderer" | "loop" | "nextFrame"
> & {
  readonly world: {
    readonly input: {
      readonly gamepad: GamepadPoller;
    };
  };
};

interface Disposable {
  dispose(): void;
}

export class RuntimeSession {
  #host: RuntimeSessionHost;
  #abort = new AbortController();
  #mounted: Disposable[] = [];

  constructor(
    host: RuntimeSessionHost,
    settings: RuntimeSessionSettings
  ) {
    this.#host = host;
    this.#claimCanvasKeys();
    if (settings.focusCanvas) {
      this.#refocusCanvasOnClick();
    }

    if (settings.focusHint !== null) {
      this.#mounted.push(
        mountFocusHint(
          host.canvas,
          host.overlay,
          settings.focusHint
        )
      );
    }

    if (settings.viewHelper !== null) {
      this.#mounted.push(
        mountViewHelper(
          host.renderer,
          settings.viewHelper
        )
      );
    }

    if (settings.renderOnDemand) {
      this.#watchActivity();
    }

    if (settings.suspendWhenHidden) {
      this.#suspendAfterFirstFrame();
    }
  }

  dispose(): void {
    this.#abort.abort();

    for (const mounted of this.#mounted.splice(0)) {
      mounted.dispose();
    }
  }

  #watchActivity(): void {
    const { canvas, loop, world } = this.#host;

    this.#mounted.push(
      new PageActivity(
        canvas,
        () => loop.invalidate()
      )
    );
    const view = canvas.ownerDocument.defaultView;
    if (view !== null) {
      this.#mounted.push(
        new GamepadActivity(
          world.input.gamepad,
          loop,
          view,
          () => loop.invalidate()
        )
      );
    }
  }

  #claimCanvasKeys(): void {
    const { canvas } = this.#host;

    canvas.focus();
    canvas.addEventListener(
      "keypress",
      (event) => event.preventDefault(),
      { signal: this.#abort.signal }
    );
  }

  #refocusCanvasOnClick(): void {
    const { canvas } = this.#host;

    canvas.ownerDocument.addEventListener(
      "click",
      () => {
        if (canvas.ownerDocument.activeElement !== canvas) {
          canvas.focus();
        }
      },
      { signal: this.#abort.signal }
    );
  }

  #suspendAfterFirstFrame(): void {
    const { canvas, loop } = this.#host;
    const { signal } = this.#abort;

    void this.#host.nextFrame().then(() => {
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
