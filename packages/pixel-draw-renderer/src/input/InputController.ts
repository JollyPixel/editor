// Import Internal Dependencies
import type { Viewport } from "../rendering/Viewport.ts";
import type { Vec2 } from "../types.ts";
import type { InputActions } from "./InputActions.ts";
import {
  Keybindings,
  type KeybindingAction,
  type KeybindingsMap
} from "./Keybindings.ts";
import { isEditableTarget } from "./utils.ts";
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

function neverPanOnPrimary(): boolean {
  return false;
}

function ignoreCtrlWheel(
  _delta: number
): boolean {
  return false;
}

function isMouseButtonPressed(
  buttons: number,
  buttonMask: number
): boolean {
  return (buttons & buttonMask) !== 0;
}

export interface InputControllerOptions {
  canvas: HTMLCanvasElement;
  viewport: Viewport;
  actions: InputActions;
  /**
   * Global event target.
   * @default window
   */
  window?: WindowLike;
  /**
   * Keybinding overrides.
   * Unspecified actions keep their defaults; Shift is fixed.
   */
  keybindings?: Partial<KeybindingsMap>;
  /**
   * When it returns `true`, a plain primary drag pans.
   * @default () => false
   */
  shouldPanOnPrimary?: () => boolean;
  /**
   * Handles Ctrl+wheel before zoom. Return `true` to suppress zoom.
   * @default () => false
   */
  onCtrlWheel?: (delta: number) => boolean;
}

/**
 * Translates DOM input into coordinate-resolved canvas actions.
 */
export class InputController {
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
  #isHovering: boolean = false;
  #spaceHeld: boolean = false;
  #shouldPanOnPrimary: () => boolean;
  #onCtrlWheel: (delta: number) => boolean;

  readonly keybindings: Keybindings;

  constructor(
    options: InputControllerOptions
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
    this.#shouldPanOnPrimary = options.shouldPanOnPrimary ?? neverPanOnPrimary;
    this.#onCtrlWheel = options.onCtrlWheel ?? ignoreCtrlWheel;
    this.keybindings = new Keybindings(options.keybindings);

    this.#addEventListeners();
  }

  /**
   * Cancels the active primary drag without calling `onPrimaryUp`.
   */
  stopDrawing(): void {
    this.#isDraggingPrimary = false;
  }

  destroy(): void {
    this.#removeEventListeners();
  }

  #addEventListeners(): void {
    this.#canvas.addEventListener("mousedown", this.#handleMouseDown);
    this.#canvas.addEventListener("mouseenter", this.#handleMouseEnter);
    this.#canvas.addEventListener("mousemove", this.#handleMouseMove);
    this.#canvas.addEventListener("mouseleave", this.#handleMouseLeave);
    this.#canvas.addEventListener("mouseup", this.#handleMouseUp);
    this.#canvas.addEventListener("wheel", this.#handleWheel, { passive: false });
    this.#canvas.addEventListener("contextmenu", this.#handleContextMenu);
    this.#inputWindow.addEventListener("mousemove", this.#handleWindowMouseMove);
    this.#inputWindow.addEventListener("mouseup", this.#handleWindowMouseUp);
    this.#inputWindow.addEventListener("keydown", this.#handleKeyDown);
    this.#inputWindow.addEventListener("keyup", this.#handleKeyUp);
    this.#inputWindow.addEventListener("blur", this.#handleWindowBlur);
  }

  #removeEventListeners(): void {
    this.#canvas.removeEventListener("mousedown", this.#handleMouseDown);
    this.#canvas.removeEventListener("mouseenter", this.#handleMouseEnter);
    this.#canvas.removeEventListener("mousemove", this.#handleMouseMove);
    this.#canvas.removeEventListener("mouseleave", this.#handleMouseLeave);
    this.#canvas.removeEventListener("mouseup", this.#handleMouseUp);
    this.#canvas.removeEventListener("wheel", this.#handleWheel);
    this.#canvas.removeEventListener("contextmenu", this.#handleContextMenu);
    this.#inputWindow.removeEventListener("mousemove", this.#handleWindowMouseMove);
    this.#inputWindow.removeEventListener("mouseup", this.#handleWindowMouseUp);
    this.#inputWindow.removeEventListener("keydown", this.#handleKeyDown);
    this.#inputWindow.removeEventListener("keyup", this.#handleKeyUp);
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
    this.#isHovering = true;

    switch (event.button) {
      case kMouseButton.primary: {
        if (
          this.#spaceHeld ||
          this.#shouldPanOnPrimary()
        ) {
          this.#beginPan(event);

          return;
        }

        const position = this.#resolveTexturePosition(event);
        if (position) {
          this.#isDraggingPrimary = this.#actions.onPrimaryDown(position);
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
    this.#isHovering = true;

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
        this.#actions.onPrimaryMove(position);
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

  #handleMouseEnter = (): void => {
    this.#isHovering = true;
  };

  #handleMouseLeave = (): void => {
    this.#isHovering = false;
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

  #endPanModifier(): void {
    if (!this.#spaceHeld) {
      return;
    }

    this.#spaceHeld = false;
    this.#actions.onSpaceUp();
  }

  #handleWindowBlur = (): void => {
    this.#endPan();
    this.#endTrackedDrags();
    this.#endPanModifier();
    this.#actions.onBlur();
  };

  #handleKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (
      !this.#isHovering ||
      isEditableTarget(event.target)
    ) {
      return;
    }

    if (event.key === "Shift") {
      if (!event.repeat) {
        this.#actions.onShiftDown();
      }

      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat && !this.#spaceHeld) {
        this.#spaceHeld = true;
        this.#actions.onSpaceDown();
      }

      return;
    }

    if (event.repeat) {
      return;
    }

    const action = this.keybindings.match(event);
    if (action === null) {
      return;
    }

    if (this.#dispatchKeybindingAction(action)) {
      event.preventDefault();
    }
  };

  #dispatchKeybindingAction(
    action: KeybindingAction
  ): boolean {
    switch (action) {
      case "copy":
        return this.#actions.onCopy();
      case "paste":
        return this.#actions.onPaste();
      case "undo":
        return this.#actions.onUndo();
      case "redo":
        return this.#actions.onRedo();
      case "delete":
        return this.#actions.onDelete();
      case "rotate":
        return this.#actions.onRotate();
      case "flipHorizontal":
        return this.#actions.onFlipHorizontal();
      case "flipVertical":
        return this.#actions.onFlipVertical();
      default: {
        const unexpectedAction: never = action;

        throw new Error(`Unknown keybinding action: ${unexpectedAction}`);
      }
    }
  }

  #handleKeyUp = (
    event: KeyboardEvent
  ): void => {
    if (event.key === "Shift") {
      this.#actions.onShiftUp();

      return;
    }

    if (event.code === "Space") {
      this.#endPanModifier();
    }
  };
}
