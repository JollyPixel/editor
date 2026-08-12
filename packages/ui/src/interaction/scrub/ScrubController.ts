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
import { kFallback } from "../../theme/fallbacks.ts";
import { resolveThemeToken } from "../../theme/resolveThemeToken.ts";

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
  #element: HTMLElement | null = null;
  #pointerId: number | null = null;
  #startValue = 0;
  #startX = 0;
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
    return this.#pointerId !== null;
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
    this.#end();
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

    this.#element = target;
    this.#pointerId = event.pointerId;
    this.#startValue = start;
    this.#startX = event.clientX;

    target.setPointerCapture(event.pointerId);
    target.addEventListener(
      "pointermove",
      this.#onPointerMove
    );
    target.addEventListener(
      "pointerup",
      this.#onPointerUp
    );
    target.addEventListener(
      "pointercancel",
      this.#onPointerUp
    );
    ensureDocumentStyles("jolly-drag-styles", `
      html.jolly-scrub-dragging,
      html.jolly-scrub-dragging * {
        cursor: ew-resize !important;
        user-select: none !important;
      }
    `);
    document.documentElement.classList.add(
      kDraggingClass
    );

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

    // Prevent native text selection while dragging.
    event.preventDefault();
  };

  #onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.#pointerId) {
      return;
    }

    this.#guide?.update(event.clientX);
    this.#options.onInput(
      this.#valueAt(event)
    );
  };

  #onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.#pointerId) {
      return;
    }

    const value = this.#valueAt(event);
    this.#end();
    this.#options.onCommit(value);
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
    const element = this.#element;
    if (
      element !== null &&
      this.#pointerId !== null
    ) {
      element.removeEventListener(
        "pointermove",
        this.#onPointerMove
      );
      element.removeEventListener(
        "pointerup",
        this.#onPointerUp
      );
      element.removeEventListener(
        "pointercancel",
        this.#onPointerUp
      );

      if (element.hasPointerCapture(this.#pointerId)) {
        element.releasePointerCapture(
          this.#pointerId
        );
      }
    }

    this.#element = null;
    this.#pointerId = null;
    document.documentElement.classList.remove(
      kDraggingClass
    );

    this.#guide?.destroy();
    this.#guide = null;
  }
}
