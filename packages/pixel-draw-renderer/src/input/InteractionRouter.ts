// Import Internal Dependencies
import type { InteractionMode } from "./modes/InteractionMode.ts";
import type { InputActions } from "./InputActions.ts";
import type { CanvasShortcuts } from "./CanvasShortcuts.ts";
import type { Viewport } from "../rendering/Viewport.ts";
import type {
  Mode,
  RotationDirection,
  Vec2
} from "../types.ts";

export interface InteractionRouterOptions {
  modes: InteractionMode[];
  defaultMode: Mode;
  viewport: Viewport;
  setCursor: (cursor: string) => void;
  onUndo: () => boolean;
  onRedo: () => boolean;
  onCopy?: () => boolean;
  onPaste?: () => boolean;
  onModeChange?: (mode: Mode, previousMode: Mode) => void;
}

export type ExternalCursorMoveListener = (pos: Vec2 | null) => void;

export class InteractionRouter implements InputActions, CanvasShortcuts {
  #modes: Map<Mode, InteractionMode>;
  #active: InteractionMode;
  #viewport: Viewport;
  #setCursor: (cursor: string) => void;
  #onUndo: () => boolean;
  #onRedo: () => boolean;
  #onCopy: () => boolean;
  #onPaste: () => boolean;
  #onModeChange?: (mode: Mode, previousMode: Mode) => void;
  #textureCursor: Vec2 | null = null;
  #panHeld: boolean = false;
  #lineHeld: boolean = false;
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
    this.#onCopy = options.onCopy ?? (() => this.#active.onCopy());
    this.#onPaste = options.onPaste ?? (() => this.#active.onPaste());
    this.#onModeChange = options.onModeChange;
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
    this.#onModeChange?.(next, previous);
  }

  get textureCursor(): Vec2 | null {
    return this.#textureCursor ? { ...this.#textureCursor } : null;
  }

  highlightBrushSize(
    brushSize: number
  ): number {
    return this.#active.highlightSize(brushSize);
  }

  #syncCursor(): void {
    this.#setCursor(this.#active.cursor());
  }

  onPrimaryDown(
    position: Vec2
  ): boolean {
    const shouldTrackDrag = this.#active.onPrimaryDown(
      position
    );
    this.#syncCursor();

    return shouldTrackDrag;
  }

  onPrimaryMove(
    position: Vec2
  ): void {
    this.#active.onPrimaryMove(position);
  }

  onPrimaryUp(): void {
    this.#active.onPrimaryUp();
    this.#syncCursor();
  }

  onSecondaryDown(
    position: Vec2,
    ctrlKey: boolean
  ): boolean {
    return this.#active.onSecondaryDown(
      position,
      ctrlKey
    );
  }

  onSecondaryMove(
    position: Vec2
  ): void {
    this.#active.onSecondaryMove(position);
  }

  onSecondaryUp(): void {
    this.#active.onSecondaryUp();
  }

  onPanStart(): void {
    this.#setCursor("grabbing");
  }

  onPanMove(
    delta: Vec2
  ): void {
    this.#viewport.applyPan(
      delta.x,
      delta.y
    );
  }

  onPanEnd(): void {
    if (this.#panHeld) {
      this.#setCursor("grab");

      return;
    }

    this.#syncCursor();
  }

  onZoom(
    delta: number,
    center: Vec2
  ): void {
    this.#viewport.applyZoom(
      delta,
      center.x,
      center.y
    );
  }

  onCanvasHover(
    position: Vec2 | null
  ): void {
    this.#active.onHover(position);
  }

  onTextureCursorMove(
    position: Vec2 | null
  ): void {
    this.#textureCursor = position ? { ...position } : null;
    this.#active.onCursorMove(position);
    this.onExternalCursorMove?.(position);
  }

  onMouseUp(): void {
    this.#active.onMouseUp();
  }

  onBlur(): void {
    this.#panHeld = false;
    this.#lineHeld = false;
    this.#active.onBlur();
    this.#syncCursor();
  }

  get panHeld(): boolean {
    return this.#panHeld;
  }

  set panHeld(
    held: boolean
  ) {
    if (held === this.#panHeld) {
      return;
    }

    this.#panHeld = held;
    if (held) {
      this.#setCursor("grab");
    }
    else {
      this.#syncCursor();
    }
  }

  get lineHeld(): boolean {
    return this.#lineHeld;
  }

  set lineHeld(
    held: boolean
  ) {
    if (held === this.#lineHeld) {
      return;
    }

    this.#lineHeld = held;
    this.#active.onLineHeldChange(held);
  }

  copy(): boolean {
    return this.#onCopy();
  }

  paste(): boolean {
    return this.#onPaste();
  }

  delete(): boolean {
    return this.#active.onDelete();
  }

  undo(): boolean {
    return this.#onUndo();
  }

  redo(): boolean {
    return this.#onRedo();
  }

  rotate(
    direction: RotationDirection
  ): boolean {
    return this.#active.onRotate(direction);
  }

  flipHorizontal(): boolean {
    return this.#active.onFlipHorizontal();
  }

  flipVertical(): boolean {
    return this.#active.onFlipVertical();
  }
}
