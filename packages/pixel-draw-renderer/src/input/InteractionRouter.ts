// Import Internal Dependencies
import type { InteractionMode } from "./modes/InteractionMode.ts";
import type { InputActions } from "./InputController.ts";
import type { Viewport } from "../rendering/Viewport.ts";
import type {
  Mode,
  Vec2
} from "../types.ts";

export interface InteractionRouterOptions {
  modes: InteractionMode[];
  defaultMode: Mode;
  viewport: Viewport;
  /** Applies a resolved CSS cursor to the canvas. */
  setCursor: (cursor: string) => void;
  onUndo: () => boolean | void;
  onRedo: () => boolean | void;
}

export type ExternalCursorMoveListener = (pos: Vec2 | null) => void;

/**
 * Holds the active `InteractionMode` and forwards `InputActions` to it.
 */
export class InteractionRouter implements InputActions {
  #modes: Map<Mode, InteractionMode>;
  #active: InteractionMode;
  #viewport: Viewport;
  #setCursor: (cursor: string) => void;
  #onUndo: () => boolean | void;
  #onRedo: () => boolean | void;
  #panModifierHeld: boolean = false;
  onExternalCursorMove: ExternalCursorMoveListener | undefined;

  constructor(
    options: InteractionRouterOptions
  ) {
    this.#modes = new Map(
      options.modes.map((mode) => [mode.id, mode])
    );

    const active = this.#modes.get(options.defaultMode);
    if (!active) {
      throw new Error(`Unknown default mode: "${options.defaultMode}"`);
    }

    this.#active = active;
    this.#viewport = options.viewport;
    this.#setCursor = options.setCursor;
    this.#onUndo = options.onUndo;
    this.#onRedo = options.onRedo;
  }

  get mode(): Mode {
    return this.#active.id;
  }

  set mode(
    next: Mode
  ) {
    if (next === this.#active.id) {
      return;
    }

    const mode = this.#modes.get(next);
    if (!mode) {
      throw new Error(`Unknown mode: "${next}"`);
    }

    const previous = this.#active.id;
    this.#active.onExit(next);
    this.#active = mode;
    this.#active.onEnter(previous);
    this.#syncCursor();
  }

  /**
   * Brush-highlight size for the active mode (see `InteractionMode.highlightSize`).
   */
  highlightBrushSize(
    brushSize: number
  ): number {
    return this.#active.highlightSize(brushSize);
  }

  #syncCursor(): void {
    this.#setCursor(this.#active.cursor());
  }

  onPrimaryDown(
    tx: number,
    ty: number
  ): boolean | void {
    const handled = this.#active.onPrimaryDown({
      x: tx,
      y: ty
    });
    this.#syncCursor();

    return handled;
  }

  onPrimaryMove(
    tx: number,
    ty: number
  ): void {
    this.#active.onPrimaryMove({
      x: tx,
      y: ty
    });
  }

  onPrimaryUp(): void {
    this.#active.onPrimaryUp();
    this.#syncCursor();
  }

  onSecondaryDown(
    tx: number,
    ty: number,
    ctrlKey: boolean
  ): boolean | void {
    return this.#active.onSecondaryDown({
      x: tx,
      y: ty
    }, ctrlKey);
  }

  onSecondaryMove(
    tx: number,
    ty: number
  ): void {
    this.#active.onSecondaryMove({
      x: tx,
      y: ty
    });
  }

  onSecondaryUp(): void {
    this.#active.onSecondaryUp();
  }

  onPanStart(
    _mx: number,
    _my: number
  ): void {
    this.#setCursor("grabbing");
  }

  onPanMove(
    dx: number,
    dy: number
  ): void {
    this.#viewport.applyPan(dx, dy);
  }

  onPanEnd(): void {
    // Fall back to grab while the Space modifier is still held, otherwise
    // restore the active mode's own cursor.
    if (this.#panModifierHeld) {
      this.#setCursor("grab");

      return;
    }

    this.#syncCursor();
  }

  onZoom(
    delta: number,
    cx: number,
    cy: number
  ): void {
    this.#viewport.applyZoom(delta, cx, cy);
  }

  onMouseMove(
    cx: number,
    cy: number
  ): void {
    this.#active.onHover(cx, cy);
  }

  onCursorMove(
    pos: Vec2 | null
  ): void {
    this.#active.onCursorMove(pos);
    this.onExternalCursorMove?.(pos);
  }

  onMouseUp(): void {
    this.#active.onMouseUp();
  }

  onShiftDown(): void {
    this.#active.onShiftDown();
  }

  onShiftUp(): void {
    this.#active.onShiftUp();
  }

  onSpaceDown(): void {
    this.#panModifierHeld = true;
    this.#setCursor("grab");
  }

  onSpaceUp(): void {
    this.#panModifierHeld = false;
    this.#syncCursor();
  }

  onBlur(): void {
    this.#active.onBlur();
    this.#syncCursor();
  }

  onCopy(): boolean | void {
    return this.#active.onCopy();
  }

  onPaste(): boolean | void {
    return this.#active.onPaste();
  }

  onDelete(): boolean | void {
    return this.#active.onDelete();
  }

  onUndo(): boolean | void {
    return this.#onUndo();
  }

  onRedo(): boolean | void {
    return this.#onRedo();
  }

  onRotate(): boolean | void {
    return this.#active.onRotate();
  }

  onFlipHorizontal(): boolean | void {
    return this.#active.onFlipHorizontal();
  }

  onFlipVertical(): boolean | void {
    return this.#active.onFlipVertical();
  }
}
