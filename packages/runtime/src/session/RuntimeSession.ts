// Import Third-party Dependencies
import { suspendWhenHidden } from "@jolly-pixel/loop";

// Import Internal Dependencies
import type { Runtime } from "../Runtime.ts";
import { mountFocusHint } from "../ui/focus/mountFocusHint.ts";
import { mountViewHelper } from "../ui/viewHelper/mountViewHelper.ts";
import { PageActivity } from "./PageActivity.ts";
import type { RuntimeSessionSettings } from "./RuntimeSessionSettings.ts";

export type RuntimeSessionHost = Pick<
  Runtime,
  "canvas" | "overlay" | "renderer" | "loop" | "nextFrame"
>;

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
      this.#mounted.push(
        new PageActivity(
          host.canvas,
          () => host.loop.invalidate()
        )
      );
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
