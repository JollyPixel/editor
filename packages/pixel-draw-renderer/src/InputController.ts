// Import Internal Dependencies
import type { Vec2 } from "./types.ts";
import type { Viewport } from "./rendering/Viewport.ts";

// CONSTANTS
const kEditableInputTypes = new Set([
  "text", "search", "email", "url", "tel", "password", "number",
  "date", "datetime-local", "month", "time", "week"
]);

export interface InputActions {
  /**
   * Called on left mousedown, resolved to texture-space coordinates,
   * regardless of interaction mode — InputController has no concept of
   * "paint"/"fill"/"select"/etc, that's entirely up to the consumer. Return
   * `false` to indicate the click was fully handled as a single-shot action
   * (e.g. a flood fill) or elsewhere (e.g. committing an armed line tool),
   * so InputController shouldn't track it as a drag gesture.
   */
  onPrimaryDown(tx: number, ty: number): boolean | void;
  /**
   * Fires on every mousemove while the left button is held and the initial
   * onPrimaryDown didn't return `false`.
   */
  onPrimaryMove(tx: number, ty: number): void;
  /**
   * Fires once when a tracked primary-button drag gesture ends (canvas or
   * window mouseup). Not fired for a gesture whose onPrimaryDown returned
   * `false`.
   */
  onPrimaryUp(): void;
  onPanStart(mx: number, my: number): void;
  onPanMove(dx: number, dy: number): void;
  onPanEnd(): void;
  onZoom(delta: number, cx: number, cy: number): void;
  /**
   * Right-click (contextmenu), resolved to texture-space coordinates and
   * bounds-limited (null when outside the texture). Fires regardless of
   * mode — consumers decide what, if anything, it means for them.
   */
  onColorPick(tx: number, ty: number): void;
  onMouseMove(cx: number, cy: number): void;
  /**
   * Resolved texture-space cursor position on every mousemove (bounds-
   * limited), or null when outside the canvas/texture. Fired regardless of
   * mode or drawing state.
   */
  onCursorMove(pos: Vec2 | null): void;
  /**
   * Fires on every mouseup (canvas or window), regardless of drawing/
   * panning state — consumers decide what, if anything, it means for them.
   */
  onMouseUp(): void;
  /**
   * A non-repeat Shift keydown that isn't targeting editable UI. Carries no
   * payload — consumers query whatever state they need (mode, last cursor
   * position, ...) themselves.
   */
  onShiftDown(): void;
  onShiftUp(): void;
  onBlur(): void;
  /**
   * A non-repeat Ctrl/Cmd+C keydown that isn't targeting editable UI. Return
   * `true` to indicate it was handled (InputController calls
   * `preventDefault()` to suppress the OS copy) — return `false`/`void` to
   * let the browser's default copy behavior proceed.
   */
  onCopy(): boolean | void;
  /** Ctrl/Cmd+V counterpart to onCopy. */
  onPaste(): boolean | void;
  /** A non-repeat Delete keydown that isn't targeting editable UI. */
  onDelete(): boolean | void;
}

/**
 * Prevents Shift from being reported while the user is typing in toolbar
 * UI (e.g. a brush-size field) elsewhere in the page. Only text-entry
 * inputs count as "typing" — a range/color input left focused after a drag
 * (canvas has no tabindex, so clicking it can't steal focus back) must not
 * keep swallowing Shift.
 */
function isEditableTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable || target.tagName === "TEXTAREA") {
    return true;
  }

  return target.tagName === "INPUT" && kEditableInputTypes.has(
    (target as HTMLInputElement).type
  );
}

/**
 * Subset of the global `Window` used by InputController — global mouse
 * tracking (for drag gestures that continue past the canvas edge) and
 * keyboard/blur reporting. Narrowed to an interface so it can be injected
 * (defaults to `window`), keeping the global out of the constructor and
 * letting tests supply a fake instead of relying on a real DOM global.
 */
export interface WindowLike {
  addEventListener(type: "mousemove", listener: (event: MouseEvent) => void): void;
  addEventListener(type: "mouseup", listener: (event: MouseEvent) => void): void;
  addEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
  addEventListener(type: "keyup", listener: (event: KeyboardEvent) => void): void;
  addEventListener(type: "blur", listener: () => void): void;
  removeEventListener(type: "mousemove", listener: (event: MouseEvent) => void): void;
  removeEventListener(type: "mouseup", listener: (event: MouseEvent) => void): void;
  removeEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: "keyup", listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: "blur", listener: () => void): void;
}

export interface InputControllerOptions {
  canvas: HTMLCanvasElement;
  viewport: Viewport;
  actions: InputActions;
  /**
   * Global event target used for drag-continuation mouse tracking and
   * keyboard/blur reporting.
   * @default window
   */
  window?: WindowLike;
}

/**
 * InputController translates raw DOM mouse/keyboard events into semantic,
 * coordinate-resolved actions (primary drag, pan, zoom, color pick,
 * cursor/shift state). It has no concept of interaction "modes" (paint,
 * fill, select, ...) — that interpretation, including what a primary-button
 * drag gesture means, is left entirely to the consumer (see CanvasManager).
 */
export class InputController {
  #canvas: HTMLCanvasElement;
  #viewport: Viewport;
  #actions: InputActions;
  #window: WindowLike;
  #isPanning: boolean = false;
  #panStart: Vec2 = { x: 0, y: 0 };
  /**
   * Tracks any left-mouse-button-held drag gesture that needs a matching
   * onPrimaryUp report — armed by a non-`false` onPrimaryDown return value.
   */
  #isDragging: boolean = false;
  /**
   * Gates keydown handling (Shift/Copy/Paste/Delete) to only fire while the
   * pointer is over this canvas, so these shortcuts don't collide with a
   * host application's own document/window-wide keybinds (e.g. a 3D
   * viewport's camera controls) when the user isn't actually interacting
   * with this canvas. keyup is intentionally left ungated — see
   * #handleKeyUp.
   */
  #isHovering: boolean = false;

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
    this.#onWindowBlur = () => this.#actions.onBlur();

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
   * Stops tracking the current primary-button drag gesture without firing
   * onPrimaryUp. Lets a consumer reinterpret an in-progress gesture (e.g.
   * arming a line tool mid-stroke) without InputController fighting back
   * with further onPrimaryMove calls.
   */
  stopDrawing(): void {
    this.#isDragging = false;
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

  /**
   * Resolves a MouseEvent's client coordinates to texture space against the
   * canvas's current bounds. Centralizes the bounds+viewport lookup shared
   * by every handler that needs a texture-space position.
   */
  #resolveTexturePos(
    event: MouseEvent,
    parameters: { limit?: boolean; } = {}
  ): Vec2 | null {
    const bounds = this.#canvas.getBoundingClientRect();
    const { clientX, clientY } = event;

    return this.#viewport.getMouseTexturePosition(clientX, clientY, {
      bounds,
      limit: parameters.limit
    });
  }

  /**
   * Shared tail of #handleMouseUp/#handleWindowMouseUp: reports the end of
   * any tracked primary-button drag, then unconditionally reports mouseup.
   */
  #endDragAndReportMouseUp(): void {
    if (this.#isDragging) {
      this.#isDragging = false;
      this.#actions.onPrimaryUp();
    }

    this.#actions.onMouseUp();
  }

  #handleMouseDown(
    event: MouseEvent
  ): void {
    this.#isHovering = true;

    if (event.button === 0) {
      const pos = this.#resolveTexturePos(event);
      if (pos) {
        const handled = this.#actions.onPrimaryDown(pos.x, pos.y);
        this.#isDragging = handled !== false;
      }
    }

    if (event.button === 1) {
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
  }

  #handleMouseMove(
    event: MouseEvent
  ): void {
    event.preventDefault();
    this.#isHovering = true;

    const bounds = this.#canvas.getBoundingClientRect();
    const canvasPos = this.#viewport.getMouseCanvasPosition(
      event.clientX,
      event.clientY,
      bounds
    );
    this.#actions.onMouseMove(canvasPos.x, canvasPos.y);
    this.#actions.onCursorMove(this.#resolveTexturePos(event, {
      limit: true
    }));

    if (event.buttons === 1 && this.#isDragging) {
      const pos = this.#resolveTexturePos(event);
      if (pos) {
        this.#actions.onPrimaryMove(pos.x, pos.y);
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

  #handleWheel(
    event: WheelEvent
  ): void {
    event.preventDefault();

    const bounds = this.#canvas.getBoundingClientRect();
    const canvasPos = this.#viewport.getMouseCanvasPosition(
      event.clientX,
      event.clientY,
      bounds
    );
    this.#actions.onZoom(
      event.deltaY,
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
    event.preventDefault();

    const pos = this.#resolveTexturePos(event, {
      limit: true
    });
    if (pos) {
      this.#actions.onColorPick(pos.x, pos.y);
    }
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

    if (event.repeat) {
      return;
    }

    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    const lowerKey = event.key.toLowerCase();
    if (isCtrlOrCmd && lowerKey === "c") {
      if (this.#actions.onCopy()) {
        event.preventDefault();
      }

      return;
    }

    if (isCtrlOrCmd && lowerKey === "v") {
      if (this.#actions.onPaste()) {
        event.preventDefault();
      }

      return;
    }

    if (event.key === "Delete") {
      if (this.#actions.onDelete()) {
        event.preventDefault();
      }
    }
  }

  #handleKeyUp(
    event: KeyboardEvent
  ): void {
    if (event.key !== "Shift") {
      return;
    }

    this.#actions.onShiftUp();
  }
}
