// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  deltaFromValue,
  valueFromDelta
} from "../../numeric/valueFromDelta.ts";
import { ensureDocumentStyles } from "../ensureDocumentStyles.ts";
import { createDragGuide, type DragGuide } from "./dragGuide.ts";
import { modifierMultiplier } from "../../numeric/modifierMultiplier.ts";
import { measurePrecision } from "../../numeric/precision.ts";
import { kFallback } from "../../theme/styles/fallbacks.ts";
import { resolveThemeColor } from "../../theme/resolveThemeToken.ts";
import {
  startPointerDragSession,
  type PointerDragSessionHandle
} from "../pointer/PointerDragSession.ts";

// CONSTANTS
const kDraggingClass = "jolly-scrub-dragging";
const kScrubbingAttribute = "data-scrubbing";

export interface ScrubOptions {
  target(): HTMLElement | null;
  step(): number;
  start(): number | undefined;
  min?(): number;
  max?(): number;
  pixelsPerStep?(): number | undefined;
  /**
   * Travel before a press becomes a drag. @default 0
   */
  threshold?: number;
  /**
   * Draws the guide while dragging. @default true
   */
  guide?: boolean;
  jump?(
    event: PointerEvent
  ): number | undefined;
  onClick?(): void;
  onInput(
    value: number
  ): void;
  onCommit(
    value: number
  ): void;
}

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
      elementAttribute: kScrubbingAttribute,
      onStart: () => this.#showGuide(target),
      onMove: this.#onPointerMove,
      onFinish: this.#onPointerFinish
    });
    if (jumped !== undefined) {
      this.#options.onInput(jumped);
    }

    event.preventDefault();
  };

  #onPointerMove = (
    _clientX: number,
    _clientY: number,
    event: PointerEvent
  ): void => {
    this.#currentValue = this.#valueAt(event);
    this.#guide?.update(this.#guideOffset());
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

    const { left, top, width, height } = target.getBoundingClientRect();
    this.#guide = createDragGuide(
      left + (width / 2),
      top + (height / 2),
      resolveThemeColor(
        this.#host,
        "--jolly-text",
        String(kFallback.text)
      )
    );
  }

  #guideOffset(): number {
    return deltaFromValue({
      start: this.#startValue,
      value: this.#currentValue,
      step: this.#options.step(),
      pixelsPerStep: this.#pixelsPerStep
    });
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
      multiplier: modifierMultiplier(event),
      min: this.#options.min?.(),
      max: this.#options.max?.(),
      precision: this.#cachedPrecision(step)
    });
  }

  #cachedPrecision(
    step: number
  ): number {
    if (step !== this.#precisionStep) {
      this.#precisionStep = step;
      this.#precision = measurePrecision(this.#startValue, step);
    }

    return this.#precision;
  }

  #end(): void {
    this.#session = null;
    this.#guide?.destroy();
    this.#guide = null;
  }
}
