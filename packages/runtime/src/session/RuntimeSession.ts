// Import Third-party Dependencies
import {
  suspendWhenHidden,
  type GameLoop
} from "@jolly-pixel/loop";

// Import Internal Dependencies
import type { GamepadPoller } from "../contract/RuntimeBackend.ts";
import type { OverlayLayer } from "../overlay/OverlayLayer.ts";
import { mountFocusHint } from "./mountFocusHint.ts";
import { PageActivity } from "./PageActivity.ts";
import { GamepadActivity } from "./GamepadActivity.ts";
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
