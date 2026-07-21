// Import Internal Dependencies
import {
  Keybindings,
  type KeybindingAction,
  type KeybindingsMap
} from "./Keybindings.ts";
import type {
  Vec2
} from "../types.ts";
import type {
  Viewport
} from "../rendering/Viewport.ts";
import {
  isEditableTarget
} from "./utils.ts";

// CONSTANTS
// Approximate pixels per WheelEvent.deltaMode unit (LINE = 1, PAGE = 2), so
// line/page-based wheels (e.g. Firefox mouse) yield a pixel delta comparable
// to pixel-based ones (trackpads, most mouse wheels).
const kWheelLineHeight = 16;
const kWheelPageHeight = 100;

export interface InputActions {
  /**
   * Starts a primary interaction at texture coordinates. Return `false` for
   * single-shot actions that should not be tracked as drags.
   */
  onPrimaryDown(
    tx: number,
    ty: number
  ): boolean | void;
  /** Reports movement during a tracked primary drag. */
  onPrimaryMove(
    tx: number,
    ty: number
  ): void;
  /** Ends a tracked primary drag. */
  onPrimaryUp(): void;
  /**
   * Starts a secondary (right-click) interaction at texture coordinates.
   * `ctrlKey` reports whether Ctrl was held at the time of the click. Return
   * `false` for single-shot actions that should not be tracked as drags.
   */
  onSecondaryDown(
    tx: number,
    ty: number,
    ctrlKey: boolean
  ): boolean | void;
  /** Reports movement during a tracked secondary drag. */
  onSecondaryMove(
    tx: number,
    ty: number
  ): void;
  /** Ends a tracked secondary drag. */
  onSecondaryUp(): void;
  onPanStart(
    mx: number,
    my: number
  ): void;
  onPanMove(
    dx: number,
    dy: number
  ): void;
  onPanEnd(): void;
  onZoom(
    delta: number,
    cx: number,
    cy: number
  ): void;
  onMouseMove(
    cx: number,
    cy: number
  ): void;
  /** Reports the bounded texture position, or `null` outside the texture. */
  onCursorMove(pos: Vec2 | null): void;
  /** Reports every canvas or window mouseup. */
  onMouseUp(): void;
  /** Reports a non-repeat Shift press outside editable UI. */
  onShiftDown(): void;
  onShiftUp(): void;
  /**
   * Reports a non-repeat Space press (pan modifier) while hovering the canvas.
   * While it's held, a left-drag pans instead of triggering the primary action.
   */
  onSpaceDown(): void;
  onSpaceUp(): void;
  onBlur(): void;
  /**
   * Return `true` to handle copy and suppress the browser default.
   */
  onCopy(): boolean | void;
  /** Return `true` to handle paste and suppress the browser default. */
  onPaste(): boolean | void;
  /** Return `true` to handle Delete and suppress the browser default. */
  onDelete(): boolean | void;
  /** Return `true` to handle undo and suppress the browser default. */
  onUndo(): boolean | void;
  /** Return `true` to handle redo and suppress the browser default. */
  onRedo(): boolean | void;
  /** Return `true` to handle rotate and suppress the browser default. */
  onRotate(): boolean | void;
  /** Return `true` to handle a horizontal flip and suppress the browser default. */
  onFlipHorizontal(): boolean | void;
  /** Return `true` to handle a vertical flip and suppress the browser default. */
  onFlipVertical(): boolean | void;
}

/**
 * Injectable subset of `Window` used for global pointer, keyboard, and blur events.
 */
export interface WindowLike {
  addEventListener(
    type: "mousemove",
    listener: (event: MouseEvent) => void
  ): void;
  addEventListener(
    type: "mouseup",
    listener: (event: MouseEvent) => void
  ): void;
  addEventListener(
    type: "keydown",
    listener: (event: KeyboardEvent) => void
  ): void;
  addEventListener(
    type: "keyup",
    listener: (event: KeyboardEvent) => void
  ): void;
  addEventListener(
    type: "blur",
    listener: () => void
  ): void;
  removeEventListener(
    type: "mousemove",
    listener: (event: MouseEvent) => void
  ): void;
  removeEventListener(
    type: "mouseup",
    listener: (event: MouseEvent) => void
  ): void;
  removeEventListener(
    type: "keydown",
    listener: (event: KeyboardEvent) => void
  ): void;
  removeEventListener(
    type: "keyup",
    listener: (event: KeyboardEvent) => void
  ): void;
  removeEventListener(
    type: "blur",
    listener: () => void
  ): void;
}

export interface ResolveTexturePositionOptions {
  /** Whether to clamp the returned texture position to the texture bounds. */
  limit?: boolean;
}

export interface InputControllerOptions {
  canvas: HTMLCanvasElement;
  viewport: Viewport;
  actions: InputActions;
  /** Global event target.
   * @default window
   **/
  window?: WindowLike;
  /**
   * Keybinding overrides.
   * Unspecified actions keep their defaults; Shift is fixed.
   */
  keybindings?: Partial<KeybindingsMap>;
  /**
   * When it returns `true`, a plain left-drag pans instead of triggering the
   * primary action — used to make navigation modes (e.g. `"move"`) pan with a
   * single-finger drag, no Space chord needed. Space+drag pans regardless.
   * @default () => false
   */
  shouldPanOnPrimary?: () => boolean;
}

/**
 * Translates DOM input into coordinate-resolved canvas actions.
 */
export class InputController {
  #canvas: HTMLCanvasElement;
  #viewport: Viewport;
  #actions: InputActions;
  #window: WindowLike;
  #isPanning: boolean = false;
  #panStart: Vec2 = {
    x: 0,
    y: 0
  };
  #isDraggingPrimary: boolean = false;
  #isDraggingSecondary: boolean = false;
  #isHovering: boolean = false;
  #spaceHeld: boolean = false;
  #shouldPanOnPrimary: () => boolean;

  readonly keybindings: Keybindings;

  #onMouseDown: (event: MouseEvent) => void;
  #onMouseEnter: (event: MouseEvent) => void;
  #onMouseMove: (event: MouseEvent) => void;
  #onMouseLeave: (event: MouseEvent) => void;
  #onMouseUp: (event: MouseEvent) => void;
  #onWheel: (event: WheelEvent) => void;
  #onContextMenu: (event: MouseEvent) => void;
  #onWindowMouseMove: (event: MouseEvent) => void;
  #onWindowMouseUp: (event: MouseEvent) => void;
  #onKeyDown: (event: KeyboardEvent) => void;
  #onKeyUp: (event: KeyboardEvent) => void;
  #onWindowBlur: () => void;

  constructor(
    options: InputControllerOptions
  ) {
    const {
      canvas,
      viewport,
      actions,
      window: windowLike = window
    } = options;

    this.#canvas = canvas;
    this.#viewport = viewport;
    this.#actions = actions;
    this.#window = windowLike;
    this.#shouldPanOnPrimary = options.shouldPanOnPrimary ?? (() => false);
    this.keybindings = new Keybindings(options.keybindings);

    this.#onMouseDown = (event) => this.#handleMouseDown(event);
    this.#onMouseEnter = () => this.#handleMouseEnter();
    this.#onMouseMove = (event) => this.#handleMouseMove(event);
    this.#onMouseLeave = (event) => this.#handleMouseLeave(event);
    this.#onMouseUp = (event) => this.#handleMouseUp(event);
    this.#onWheel = (event) => this.#handleWheel(event);
    this.#onContextMenu = (event) => this.#handleContextMenu(event);
    this.#onWindowMouseMove = (event) => this.#handleWindowMouseMove(event);
    this.#onWindowMouseUp = () => this.#handleWindowMouseUp();
    this.#onKeyDown = (event) => this.#handleKeyDown(event);
    this.#onKeyUp = (event) => this.#handleKeyUp(event);
    this.#onWindowBlur = () => this.#handleWindowBlur();

    this.#canvas.addEventListener("mousedown", this.#onMouseDown);
    this.#canvas.addEventListener("mouseenter", this.#onMouseEnter);
    this.#canvas.addEventListener("mousemove", this.#onMouseMove);
    this.#canvas.addEventListener("mouseleave", this.#onMouseLeave);
    this.#canvas.addEventListener("mouseup", this.#onMouseUp);
    this.#canvas.addEventListener("wheel", this.#onWheel, { passive: false });
    this.#canvas.addEventListener("contextmenu", this.#onContextMenu);
    this.#window.addEventListener("mousemove", this.#onWindowMouseMove);
    this.#window.addEventListener("mouseup", this.#onWindowMouseUp);
    this.#window.addEventListener("keydown", this.#onKeyDown);
    this.#window.addEventListener("keyup", this.#onKeyUp);
    this.#window.addEventListener("blur", this.#onWindowBlur);
  }

  /**
    * Cancels the active primary drag without calling `onPrimaryUp`.
   */
  stopDrawing(): void {
    this.#isDraggingPrimary = false;
  }

  destroy(): void {
    this.#canvas.removeEventListener("mousedown", this.#onMouseDown);
    this.#canvas.removeEventListener("mouseenter", this.#onMouseEnter);
    this.#canvas.removeEventListener("mousemove", this.#onMouseMove);
    this.#canvas.removeEventListener("mouseleave", this.#onMouseLeave);
    this.#canvas.removeEventListener("mouseup", this.#onMouseUp);
    this.#canvas.removeEventListener("wheel", this.#onWheel);
    this.#canvas.removeEventListener("contextmenu", this.#onContextMenu);
    this.#window.removeEventListener("mousemove", this.#onWindowMouseMove);
    this.#window.removeEventListener("mouseup", this.#onWindowMouseUp);
    this.#window.removeEventListener("keydown", this.#onKeyDown);
    this.#window.removeEventListener("keyup", this.#onKeyUp);
    this.#window.removeEventListener("blur", this.#onWindowBlur);
  }

  #resolveTexturePos(
    event: MouseEvent,
    parameters: ResolveTexturePositionOptions = {}
  ): Vec2 | null {
    const bounds = this.#canvas.getBoundingClientRect();
    const { clientX, clientY } = event;

    return this.#viewport.mouseTexturePosition(clientX, clientY, {
      bounds,
      limit: parameters.limit
    });
  }

  #endDragAndReportMouseUp(): void {
    if (this.#isDraggingPrimary) {
      this.#isDraggingPrimary = false;
      this.#actions.onPrimaryUp();
    }

    if (this.#isDraggingSecondary) {
      this.#isDraggingSecondary = false;
      this.#actions.onSecondaryUp();
    }

    this.#actions.onMouseUp();
  }

  #beginPan(
    event: MouseEvent
  ): void {
    this.#isPanning = true;
    this.#panStart = {
      x: event.clientX,
      y: event.clientY
    };
    this.#actions.onPanStart(
      event.clientX,
      event.clientY
    );
  }

  #handleMouseDown(
    event: MouseEvent
  ): void {
    this.#isHovering = true;

    // A left-drag pans (over the primary action) when Space is held or the
    // active mode navigates (e.g. "move") — both trackpad-friendly, no middle
    // button needed.
    if (event.button === 0 && (this.#spaceHeld || this.#shouldPanOnPrimary())) {
      this.#beginPan(event);

      return;
    }

    if (event.button === 0) {
      const pos = this.#resolveTexturePos(event);
      if (pos) {
        const handled = this.#actions.onPrimaryDown(pos.x, pos.y);
        this.#isDraggingPrimary = handled !== false;
      }
    }

    if (event.button === 2) {
      const pos = this.#resolveTexturePos(event);
      if (pos) {
        const handled = this.#actions.onSecondaryDown(pos.x, pos.y, event.ctrlKey);
        this.#isDraggingSecondary = handled !== false;
      }
    }

    if (event.button === 1) {
      this.#beginPan(event);
    }
  }

  #handleMouseMove(
    event: MouseEvent
  ): void {
    event.preventDefault();
    this.#isHovering = true;

    const bounds = this.#canvas.getBoundingClientRect();
    const canvasPos = this.#viewport.mouseCanvasPosition(
      event.clientX,
      event.clientY,
      bounds
    );
    this.#actions.onMouseMove(canvasPos.x, canvasPos.y);
    this.#actions.onCursorMove(this.#resolveTexturePos(event, {
      limit: true
    }));

    if (event.buttons === 1 && this.#isDraggingPrimary) {
      const pos = this.#resolveTexturePos(event);
      if (pos) {
        this.#actions.onPrimaryMove(pos.x, pos.y);
      }
    }

    if ((event.buttons & 2) !== 0 && this.#isDraggingSecondary) {
      const pos = this.#resolveTexturePos(event);
      if (pos) {
        this.#actions.onSecondaryMove(pos.x, pos.y);
      }
    }
  }

  #handleMouseEnter(): void {
    this.#isHovering = true;
  }

  #handleMouseLeave(
    _event: MouseEvent
  ): void {
    this.#isHovering = false;
    this.#actions.onMouseMove(-1, -1);
    this.#actions.onCursorMove(null);
  }

  #handleMouseUp(
    _event: MouseEvent
  ): void {
    this.#endDragAndReportMouseUp();
  }

  // Converts a wheel delta to an approximate pixel amount regardless of
  // deltaMode, so zoom steps are consistent across browsers and devices.
  #normalizeWheelDelta(
    event: WheelEvent
  ): number {
    if (event.deltaMode === 1) {
      return event.deltaY * kWheelLineHeight;
    }
    if (event.deltaMode === 2) {
      return event.deltaY * kWheelPageHeight;
    }

    return event.deltaY;
  }

  #handleWheel(
    event: WheelEvent
  ): void {
    // Also suppresses the browser's pinch page-zoom, which arrives here as a
    // ctrlKey wheel event and drives the canvas zoom instead.
    event.preventDefault();

    const bounds = this.#canvas.getBoundingClientRect();
    const canvasPos = this.#viewport.mouseCanvasPosition(
      event.clientX,
      event.clientY,
      bounds
    );
    this.#actions.onZoom(
      this.#normalizeWheelDelta(event),
      canvasPos.x,
      canvasPos.y
    );
    this.#actions.onMouseMove(
      canvasPos.x,
      canvasPos.y
    );
  }

  #handleContextMenu(
    event: MouseEvent
  ): void {
    // Right-click drives the secondary-color stroke (see #handleMouseDown);
    // always suppress the browser's own context menu for it.
    event.preventDefault();
  }

  #handleWindowMouseMove(
    event: MouseEvent
  ): void {
    if (!this.#isPanning) {
      return;
    }

    const dx = event.clientX - this.#panStart.x;
    const dy = event.clientY - this.#panStart.y;
    this.#panStart = {
      x: event.clientX,
      y: event.clientY
    };
    this.#actions.onPanMove(dx, dy);
  }

  #handleWindowMouseUp(): void {
    if (this.#isPanning) {
      this.#isPanning = false;
      this.#actions.onPanEnd();
    }

    this.#endDragAndReportMouseUp();
  }

  #endPanModifier(): void {
    if (!this.#spaceHeld) {
      return;
    }

    this.#spaceHeld = false;
    this.#actions.onSpaceUp();
  }

  #handleWindowBlur(): void {
    if (this.#isPanning) {
      this.#isPanning = false;
      this.#actions.onPanEnd();
    }

    this.#endPanModifier();
    this.#actions.onBlur();
  }

  #handleKeyDown(
    event: KeyboardEvent
  ): void {
    if (!this.#isHovering) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key === "Shift") {
      if (!event.repeat) {
        this.#actions.onShiftDown();
      }

      return;
    }

    if (event.code === "Space") {
      // Suppress the page from scrolling while Space arms the pan modifier.
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

    const handled = this.#dispatchKeybindingAction(action);
    if (handled) {
      event.preventDefault();
    }
  }

  #dispatchKeybindingAction(
    action: KeybindingAction
  ): boolean | void {
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
      default:
        return undefined;
    }
  }

  #handleKeyUp(
    event: KeyboardEvent
  ): void {
    if (event.key === "Shift") {
      this.#actions.onShiftUp();

      return;
    }

    if (event.code === "Space") {
      this.#endPanModifier();
    }
  }
}
