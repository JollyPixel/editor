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
import { precisionOf } from "../../numeric/precision.ts";
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
  /**
   * Pointer travel per step, or `undefined` for the default of 4.
   */
  pixelsPerStep?(): number | undefined;
  /**
   * Travel before a press becomes a drag. @default 0
   */
  threshold?: number;
  /**
   * Draws the dashed guide while dragging. @default true
   */
  guide?: boolean;
  /**
   * Value the press jumps to, or `undefined` to scrub from the current value.
   */
  jump?(
    event: PointerEvent
  ): number | undefined;
  /**
   * Called when a press is released before it crosses a non-zero `threshold`.
   */
  onClick?(): void;
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
  #originValue = 0;
  #startValue = 0;
  #startX = 0;
  #pixelsPerStep: number | undefined;
  #currentValue = 0;
  #precisionStep: number | null = null;
  #precision = 0;
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

    const jumped = this.#options.jump?.(event);
    this.#originValue = start;
    this.#startValue = jumped ?? start;
    this.#startX = event.clientX;
    this.#currentValue = this.#startValue;
    this.#pixelsPerStep = this.#options.pixelsPerStep?.();
    this.#precisionStep = null;
    ensureDocumentStyles("jolly-drag-styles", `
      html.jolly-scrub-dragging,
      html.jolly-scrub-dragging * {
        cursor: ew-resize !important;
        user-select: none !important;
      }
    `);

    this.#session = startPointerDragSession({
      element: target,
      event,
      threshold: jumped === undefined ? this.#options.threshold : 0,
      documentClass: kDraggingClass,
      onStart: () => this.#showGuide(target),
      onMove: this.#onPointerMove,
      onFinish: this.#onPointerFinish
    });
    if (jumped !== undefined) {
      this.#options.onInput(jumped);
    }

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
    started: boolean,
    event: PointerEvent | null
  ): void => {
    this.#end();
    if (!started) {
      if (result === "commit") {
        this.#options.onClick?.();
      }

      return;
    }

    if (result === "commit") {
      if (event !== null) {
        this.#currentValue = this.#valueAt(event);
      }
      this.#options.onCommit(this.#currentValue);
    }
    else {
      this.#options.onInput(this.#originValue);
    }
  };

  #showGuide(
    target: HTMLElement
  ): void {
    if (this.#options.guide === false) {
      return;
    }

    const { top, height } = target.getBoundingClientRect();
    this.#guide = createDragGuide(
      top + (height / 2),
      this.#startX,
      resolveThemeToken(
        this.#host as HTMLElement,
        "--jolly-focus-ring",
        String(kFallback.focusRing)
      )
    );
  }

  #valueAt(
    event: PointerEvent
  ): number {
    const step = this.#options.step();

    return valueFromDelta({
      start: this.#startValue,
      deltaPx: event.clientX - this.#startX,
      step,
      pixelsPerStep: this.#pixelsPerStep,
      multiplier: multiplierFor(event),
      min: this.#options.min?.(),
      max: this.#options.max?.(),
      precision: this.#precisionFor(step)
    });
  }

  #precisionFor(
    step: number
  ): number {
    if (step !== this.#precisionStep) {
      this.#precisionStep = step;
      this.#precision = precisionOf(this.#startValue, step);
    }

    return this.#precision;
  }

  #end(): void {
    this.#session = null;
    this.#guide?.destroy();
    this.#guide = null;
  }
}
