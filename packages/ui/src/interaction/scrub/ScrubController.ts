// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import { valueFromDelta } from "../../numeric/valueFromDelta.ts";
import { ensureDocumentStyles } from "../ensureDocumentStyles.ts";
import { createDragGuide, type DragGuide } from "./dragGuide.ts";
import { multiplierFor } from "../../numeric/modifierMultiplier.ts";
import { kFallback } from "../../theme/styles/fallbacks.ts";
import { resolveThemeToken } from "../../theme/resolveThemeToken.ts";
import {
  startPointerDragSession,
  type PointerDragSessionHandle
} from "../pointer/PointerDragSession.ts";

// CONSTANTS
const kDraggingClass = "jolly-scrub-dragging";

export interface ScrubOptions {
  /**
   * Resolves the current scrub target.
   */
  target(): HTMLElement | null;
  step(): number;
  /**
   * Value at drag start.
   */
  start(): number | undefined;
  min?(): number;
  max?(): number;
  onInput(
    value: number
  ): void;
  onCommit(
    value: number
  ): void;
}

/**
 * Handles pointer scrubbing from the value captured at `pointerdown`.
 */
export class ScrubController implements ReactiveController {
  #host: ReactiveControllerHost & HTMLElement;
  #options: ScrubOptions;
  #session: PointerDragSessionHandle | null = null;
  #startValue = 0;
  #startX = 0;
  #currentValue = 0;
  #guide: DragGuide | null = null;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    options: ScrubOptions
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  get dragging(): boolean {
    return this.#session !== null;
  }

  hostConnected(): void {
    this.#host.addEventListener(
      "pointerdown",
      this.#onPointerDown
    );
  }

  hostDisconnected(): void {
    this.#host.removeEventListener(
      "pointerdown",
      this.#onPointerDown
    );
    this.#session?.cancel();
  }

  #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.dragging) {
      return;
    }

    const target = this.#options.target();
    if (
      target === null ||
      !event.composedPath().includes(target)
    ) {
      return;
    }

    // Mixed values have no scrub starting point.
    const start = this.#options.start();
    if (start === undefined) {
      return;
    }

    this.#startValue = start;
    this.#startX = event.clientX;
    this.#currentValue = start;
    ensureDocumentStyles("jolly-drag-styles", `
      html.jolly-scrub-dragging,
      html.jolly-scrub-dragging * {
        cursor: ew-resize !important;
        user-select: none !important;
      }
    `);
    const { top, height } = target.getBoundingClientRect();
    this.#guide = createDragGuide(
      top + (height / 2),
      event.clientX,
      resolveThemeToken(
        this.#host as HTMLElement,
        "--jolly-focus-ring",
        String(kFallback.focusRing)
      )
    );

    this.#session = startPointerDragSession({
      element: target,
      event,
      documentClass: kDraggingClass,
      onMove: this.#onPointerMove,
      onFinish: this.#onPointerFinish
    });

    // Prevent native text selection while dragging.
    event.preventDefault();
  };

  #onPointerMove = (
    clientX: number,
    _clientY: number,
    event: PointerEvent
  ): void => {
    this.#guide?.update(clientX);
    this.#currentValue = this.#valueAt(event);
    this.#options.onInput(this.#currentValue);
  };

  #onPointerFinish = (
    result: "commit" | "cancel",
    _started: boolean,
    event: PointerEvent | null
  ): void => {
    if (result === "commit" && event !== null) {
      this.#currentValue = this.#valueAt(event);
    }

    this.#end();
    if (result === "commit") {
      this.#options.onCommit(this.#currentValue);
    }
    else {
      this.#options.onInput(this.#startValue);
    }
  };

  #valueAt(
    event: PointerEvent
  ): number {
    return valueFromDelta({
      start: this.#startValue,
      deltaPx: event.clientX - this.#startX,
      step: this.#options.step(),
      multiplier: multiplierFor(event),
      min: this.#options.min?.(),
      max: this.#options.max?.()
    });
  }

  #end(): void {
    this.#session = null;
    this.#guide?.destroy();
    this.#guide = null;
  }
}
