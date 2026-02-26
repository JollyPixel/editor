// Import Internal Dependencies
import type { Mode, Vec2 } from "./types.ts";
import type { Viewport } from "./Viewport.ts";

export interface InputActions {
  onDrawStart(tx: number, ty: number): void;
  onDrawMove(tx: number, ty: number): void;
  onDrawEnd(): void;
  onPanStart(mx: number, my: number): void;
  onPanMove(dx: number, dy: number): void;
  onPanEnd(): void;
  onZoom(delta: number, cx: number, cy: number): void;
  onColorPick(tx: number, ty: number): void;
  onMouseMove(cx: number, cy: number): void;
}

export interface InputControllerOptions {
  canvas: HTMLCanvasElement;
  viewport: Viewport;
  actions: InputActions;
  /**
   * Initial interaction mode. Can be either "paint" or "move".
   * @default "paint"
   */
  mode?: Mode;
}

/**
 * InputController handles user interactions with the canvas, including drawing, panning, zooming, and color picking.
 * It listens to mouse events on the canvas and translates them into actions that affect the viewport and texture.
 * The controller manages different interaction modes (paint and move) and ensures that the appropriate actions are triggered based on user input.
 */
export class InputController {
  #canvas: HTMLCanvasElement;
  #viewport: Viewport;
  #actions: InputActions;
  #mode: Mode;
  #isPanning: boolean = false;
  #panStart: Vec2 = { x: 0, y: 0 };
  #isDrawing: boolean = false;

  #onMouseDown: (event: MouseEvent) => void;
  #onMouseMove: (event: MouseEvent) => void;
  #onMouseLeave: (event: MouseEvent) => void;
  #onMouseUp: (event: MouseEvent) => void;
  #onWheel: (event: WheelEvent) => void;
  #onContextMenu: (event: MouseEvent) => void;
  #onWindowMouseMove: (event: MouseEvent) => void;
  #onWindowMouseUp: (event: MouseEvent) => void;

  constructor(
    options: InputControllerOptions
  ) {
    const {
      canvas,
      viewport,
      actions,
      mode = "paint"
    } = options;

    this.#canvas = canvas;
    this.#viewport = viewport;
    this.#actions = actions;
    this.#mode = mode;

    this.#onMouseDown = (event) => this.#handleMouseDown(event);
    this.#onMouseMove = (event) => this.#handleMouseMove(event);
    this.#onMouseLeave = (event) => this.#handleMouseLeave(event);
    this.#onMouseUp = (event) => this.#handleMouseUp(event);
    this.#onWheel = (event) => this.#handleWheel(event);
    this.#onContextMenu = (event) => this.#handleContextMenu(event);
    this.#onWindowMouseMove = (event) => this.#handleWindowMouseMove(event);
    this.#onWindowMouseUp = () => this.#handleWindowMouseUp();

    this.#canvas.addEventListener("mousedown", this.#onMouseDown);
    this.#canvas.addEventListener("mousemove", this.#onMouseMove);
    this.#canvas.addEventListener("mouseleave", this.#onMouseLeave);
    this.#canvas.addEventListener("mouseup", this.#onMouseUp);
    this.#canvas.addEventListener("wheel", this.#onWheel, { passive: false });
    this.#canvas.addEventListener("contextmenu", this.#onContextMenu);
    window.addEventListener("mousemove", this.#onWindowMouseMove);
    window.addEventListener("mouseup", this.#onWindowMouseUp);
  }

  getMode(): Mode {
    return this.#mode;
  }

  setMode(
    mode: Mode
  ): void {
    this.#mode = mode;
  }

  destroy(): void {
    this.#canvas.removeEventListener("mousedown", this.#onMouseDown);
    this.#canvas.removeEventListener("mousemove", this.#onMouseMove);
    this.#canvas.removeEventListener("mouseleave", this.#onMouseLeave);
    this.#canvas.removeEventListener("mouseup", this.#onMouseUp);
    this.#canvas.removeEventListener("wheel", this.#onWheel);
    this.#canvas.removeEventListener("contextmenu", this.#onContextMenu);
    window.removeEventListener("mousemove", this.#onWindowMouseMove);
    window.removeEventListener("mouseup", this.#onWindowMouseUp);
  }

  #handleMouseDown(
    event: MouseEvent
  ): void {
    const bounds = this.#canvas.getBoundingClientRect();

    if (this.#mode === "paint" && event.button === 0) {
      const pos = this.#viewport.getMouseTexturePosition(event.clientX, event.clientY, { bounds });
      if (pos) {
        this.#isDrawing = true;
        this.#actions.onDrawStart(pos.x, pos.y);
      }
    }

    if (event.button === 1) {
      this.#isPanning = true;
      this.#panStart = { x: event.clientX, y: event.clientY };
      this.#actions.onPanStart(event.clientX, event.clientY);
    }
  }

  #handleMouseMove(
    event: MouseEvent
  ): void {
    event.preventDefault();

    const bounds = this.#canvas.getBoundingClientRect();
    const canvasPos = this.#viewport.getMouseCanvasPosition(event.clientX, event.clientY, bounds);
    this.#actions.onMouseMove(canvasPos.x, canvasPos.y);

    if (this.#mode === "paint" && event.buttons === 1 && this.#isDrawing) {
      const pos = this.#viewport.getMouseTexturePosition(
        event.clientX,
        event.clientY,
        { bounds }
      );
      if (pos) {
        this.#actions.onDrawMove(pos.x, pos.y);
      }
    }
  }

  #handleMouseLeave(
    _event: MouseEvent
  ): void {
    this.#actions.onMouseMove(-1, -1);
  }

  #handleMouseUp(
    _event: MouseEvent
  ): void {
    if (this.#isDrawing) {
      this.#isDrawing = false;
      this.#actions.onDrawEnd();
    }
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
    this.#actions.onZoom(event.deltaY, canvasPos.x, canvasPos.y);

    if (this.#mode === "paint") {
      this.#actions.onMouseMove(canvasPos.x, canvasPos.y);
    }
  }

  #handleContextMenu(
    event: MouseEvent
  ): void {
    event.preventDefault();

    if (this.#mode === "paint" && event.button === 2) {
      const bounds = this.#canvas.getBoundingClientRect();
      const pos = this.#viewport.getMouseTexturePosition(
        event.clientX,
        event.clientY,
        { bounds, limit: true }
      );
      if (pos) {
        this.#actions.onColorPick(pos.x, pos.y);
      }
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

    if (this.#isDrawing) {
      this.#isDrawing = false;
      this.#actions.onDrawEnd();
    }
  }
}
