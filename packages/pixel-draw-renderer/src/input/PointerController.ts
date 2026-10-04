// Import Internal Dependencies
import type { Viewport } from "../rendering/Viewport.ts";
import type { Vec2 } from "../types.ts";
import type { InputActions } from "./InputActions.ts";
import type { WindowLike } from "./WindowLike.ts";

// CONSTANTS
const kMouseButton = {
  primary: 0,
  auxiliary: 1,
  secondary: 2
} as const;

const kMouseButtonMask = {
  primary: 1,
  secondary: 2
} as const;

const kWheelDeltaMode = {
  pixel: 0,
  line: 1,
  page: 2
} as const;

// Approximate CSS-pixel equivalents for line and page wheel deltas.
const kWheelLineDeltaPixels = 16;
const kWheelPageDeltaPixels = 100;

function isMouseButtonPressed(
  buttons: number,
  buttonMask: number
): boolean {
  return (buttons & buttonMask) !== 0;
}

export interface PointerControllerOptions {
  canvas: HTMLCanvasElement;
  viewport: Viewport;
  actions: InputActions;
  /**
   * Global event target.
   * @default window
   */
  window?: WindowLike;
  /**
   * When it returns `true`, a plain primary drag pans.
   */
  shouldPanOnPrimary: () => boolean;
  /**
   * Handles Ctrl+wheel before zoom. Return `true` to suppress zoom.
   */
  onCtrlWheel: (delta: number) => boolean;
}

export class PointerController {
  #canvas: HTMLCanvasElement;
  #viewport: Viewport;
  #actions: InputActions;
  #inputWindow: WindowLike;
  #isPanning: boolean = false;
  #panPosition: Vec2 = {
    x: 0,
    y: 0
  };
  #isDraggingPrimary: boolean = false;
  #isDraggingSecondary: boolean = false;
  #shouldPanOnPrimary: () => boolean;
  #onCtrlWheel: (delta: number) => boolean;

  constructor(
    options: PointerControllerOptions
  ) {
    const {
      canvas,
      viewport,
      actions,
      window: inputWindow = window
    } = options;

    this.#canvas = canvas;
    this.#viewport = viewport;
    this.#actions = actions;
    this.#inputWindow = inputWindow;
    this.#shouldPanOnPrimary = options.shouldPanOnPrimary;
    this.#onCtrlWheel = options.onCtrlWheel;

    this.#addEventListeners();
  }

  stopDrawing(): void {
    this.#isDraggingPrimary = false;
  }

  destroy(): void {
    this.#removeEventListeners();
  }

  #addEventListeners(): void {
    this.#canvas.addEventListener("mousedown", this.#handleMouseDown);
    this.#canvas.addEventListener("mousemove", this.#handleMouseMove);
    this.#canvas.addEventListener("mouseleave", this.#handleMouseLeave);
    this.#canvas.addEventListener("mouseup", this.#handleMouseUp);
    this.#canvas.addEventListener("wheel", this.#handleWheel, { passive: false });
    this.#canvas.addEventListener("contextmenu", this.#handleContextMenu);
    this.#inputWindow.addEventListener("mousemove", this.#handleWindowMouseMove);
    this.#inputWindow.addEventListener("mouseup", this.#handleWindowMouseUp);
    this.#inputWindow.addEventListener("blur", this.#handleWindowBlur);
  }

  #removeEventListeners(): void {
    this.#canvas.removeEventListener("mousedown", this.#handleMouseDown);
    this.#canvas.removeEventListener("mousemove", this.#handleMouseMove);
    this.#canvas.removeEventListener("mouseleave", this.#handleMouseLeave);
    this.#canvas.removeEventListener("mouseup", this.#handleMouseUp);
    this.#canvas.removeEventListener("wheel", this.#handleWheel);
    this.#canvas.removeEventListener("contextmenu", this.#handleContextMenu);
    this.#inputWindow.removeEventListener("mousemove", this.#handleWindowMouseMove);
    this.#inputWindow.removeEventListener("mouseup", this.#handleWindowMouseUp);
    this.#inputWindow.removeEventListener("blur", this.#handleWindowBlur);
  }

  #resolveTexturePosition(
    event: MouseEvent
  ): Vec2 | null {
    const bounds = this.#canvas.getBoundingClientRect();

    return this.#viewport.mouseTexturePosition(
      event.clientX,
      event.clientY,
      { bounds }
    );
  }

  #resolveBoundedTexturePosition(
    event: MouseEvent
  ): Vec2 | null {
    const bounds = this.#canvas.getBoundingClientRect();

    return this.#viewport.mouseTexturePosition(
      event.clientX,
      event.clientY,
      {
        bounds,
        limit: true
      }
    );
  }

  #resolveCanvasPosition(
    event: MouseEvent
  ): Vec2 {
    const bounds = this.#canvas.getBoundingClientRect();

    return this.#viewport.mouseCanvasPosition(
      event.clientX,
      event.clientY,
      bounds
    );
  }

  #endTrackedDrags(): void {
    if (this.#isDraggingPrimary) {
      this.#isDraggingPrimary = false;
      this.#actions.onPrimaryUp();
    }

    if (this.#isDraggingSecondary) {
      this.#isDraggingSecondary = false;
      this.#actions.onSecondaryUp();
    }
  }

  #reportMouseUp(): void {
    this.#endTrackedDrags();
    this.#actions.onMouseUp();
  }

  #beginPan(
    event: MouseEvent
  ): void {
    this.#isPanning = true;
    this.#panPosition = {
      x: event.clientX,
      y: event.clientY
    };
    this.#actions.onPanStart();
  }

  #endPan(): void {
    if (!this.#isPanning) {
      return;
    }

    this.#isPanning = false;
    this.#actions.onPanEnd();
  }

  #handleMouseDown = (
    event: MouseEvent
  ): void => {
    switch (event.button) {
      case kMouseButton.primary: {
        if (this.#shouldPanOnPrimary()) {
          this.#beginPan(event);

          return;
        }

        const position = this.#resolveTexturePosition(event);
        if (position) {
          this.#isDraggingPrimary = this.#actions.onPrimaryDown(
            position,
            this.#resolveCanvasPosition(event)
          );
        }

        return;
      }
      case kMouseButton.secondary: {
        const position = this.#resolveTexturePosition(event);
        if (position) {
          this.#isDraggingSecondary = this.#actions.onSecondaryDown(
            position,
            event.ctrlKey
          );
        }

        return;
      }
      case kMouseButton.auxiliary:
        this.#beginPan(event);
    }
  };

  #handleMouseMove = (
    event: MouseEvent
  ): void => {
    event.preventDefault();

    this.#actions.onCanvasHover(
      this.#resolveCanvasPosition(event)
    );
    this.#actions.onTextureCursorMove(
      this.#resolveBoundedTexturePosition(event)
    );

    if (
      isMouseButtonPressed(event.buttons, kMouseButtonMask.primary) &&
      this.#isDraggingPrimary
    ) {
      const position = this.#resolveTexturePosition(event);
      if (position) {
        this.#actions.onPrimaryMove(
          position,
          this.#resolveCanvasPosition(event)
        );
      }
    }

    if (
      isMouseButtonPressed(event.buttons, kMouseButtonMask.secondary) &&
      this.#isDraggingSecondary
    ) {
      const position = this.#resolveTexturePosition(event);
      if (position) {
        this.#actions.onSecondaryMove(position);
      }
    }
  };

  #handleMouseLeave = (): void => {
    this.#actions.onCanvasHover(null);
    this.#actions.onTextureCursorMove(null);
  };

  #handleMouseUp = (): void => {
    this.#reportMouseUp();
  };

  #normalizeWheelDelta(
    event: WheelEvent
  ): number {
    switch (event.deltaMode) {
      case kWheelDeltaMode.line:
        return event.deltaY * kWheelLineDeltaPixels;
      case kWheelDeltaMode.page:
        return event.deltaY * kWheelPageDeltaPixels;
      case kWheelDeltaMode.pixel:
      default:
        return event.deltaY;
    }
  }

  #handleWheel = (
    event: WheelEvent
  ): void => {
    event.preventDefault();

    const delta = this.#normalizeWheelDelta(
      event
    );
    if (event.ctrlKey && this.#onCtrlWheel(delta)) {
      return;
    }

    const center = this.#resolveCanvasPosition(event);
    this.#actions.onZoom(
      delta,
      center
    );
    this.#actions.onCanvasHover(center);
  };

  #handleContextMenu = (
    event: MouseEvent
  ): void => {
    event.preventDefault();
  };

  #handleWindowMouseMove = (
    event: MouseEvent
  ): void => {
    if (!this.#isPanning) {
      return;
    }

    const nextPosition = {
      x: event.clientX,
      y: event.clientY
    };
    const delta = {
      x: nextPosition.x - this.#panPosition.x,
      y: nextPosition.y - this.#panPosition.y
    };
    this.#panPosition = nextPosition;
    this.#actions.onPanMove(delta);
  };

  #handleWindowMouseUp = (
    event: MouseEvent
  ): void => {
    this.#endPan();

    if (event.target === this.#canvas) {
      return;
    }

    this.#reportMouseUp();
  };

  #handleWindowBlur = (): void => {
    this.#endPan();
    this.#endTrackedDrags();
    this.#actions.onBlur();
  };
}
