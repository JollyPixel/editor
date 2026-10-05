// Import Internal Dependencies
import type { InteractionMode } from "./modes/InteractionMode.ts";
import type {
  InputActions,
  PointerPosition
} from "./InputActions.ts";
import type { BrushColorSlot } from "../tools/Brush.ts";
import type {
  Mode,
  RotationDirection,
  Vec2
} from "../types.ts";

// CONSTANTS
const kNoModes: ReadonlySet<Mode> = new Set();
const kReadOnlyFallbackMode: Mode = "move";

export interface InteractionRouterOptions {
  modes: InteractionMode[];
  defaultMode: Mode;
  setCursor: (cursor: string) => void;
  onModeChange?: (mode: Mode, previousMode: Mode) => void;
}

export type ExternalCursorMoveListener = (pos: Vec2 | null) => void;

export class InteractionRouter implements InputActions {
  #modes: Map<Mode, InteractionMode>;
  #pixelWritingModes: ReadonlySet<Mode>;
  #active: InteractionMode;
  #displaced: InteractionMode | null = null;
  #pixelsReadOnly = false;
  #setCursor: (cursor: string) => void;
  #onModeChange?: (mode: Mode, previousMode: Mode) => void;
  #textureCursor: Vec2 | null = null;
  #panHeld = false;
  #lineHeld = false;
  #isPanning = false;
  onExternalCursorMove: ExternalCursorMoveListener | undefined;

  constructor(
    options: InteractionRouterOptions
  ) {
    this.#modes = new Map(
      options.modes.map((mode) => [mode.id, mode])
    );
    this.#pixelWritingModes = new Set(
      options.modes
        .filter((mode) => mode.writesPixels)
        .map((mode) => mode.id)
    );

    const active = this.#modes.get(options.defaultMode);
    if (!active) {
      throw new Error(`Unknown default mode: "${options.defaultMode}"`);
    }

    this.#active = active;
    this.#setCursor = options.setCursor;
    this.#onModeChange = options.onModeChange;
  }

  get mode(): Mode {
    return this.#active.id;
  }

  set mode(
    next: Mode
  ) {
    if (
      next === this.#active.id ||
      this.unavailableModes.has(next)
    ) {
      return;
    }

    const mode = this.#modeOf(next);
    this.#displaced = null;
    this.#activate(mode);
  }

  get unavailableModes(): ReadonlySet<Mode> {
    return this.#pixelsReadOnly ? this.#pixelWritingModes : kNoModes;
  }

  get pixelsReadOnly(): boolean {
    return this.#pixelsReadOnly;
  }

  set pixelsReadOnly(
    readOnly: boolean
  ) {
    if (readOnly === this.#pixelsReadOnly) {
      return;
    }

    this.#pixelsReadOnly = readOnly;
    if (this.unavailableModes.has(this.#active.id)) {
      this.#displaced = this.#active;
      this.#activate(this.#modeOf(kReadOnlyFallbackMode));
    }
    else if (
      this.#displaced !== null &&
      !this.unavailableModes.has(this.#displaced.id)
    ) {
      const displaced = this.#displaced;
      this.#displaced = null;
      this.#activate(displaced);
    }
  }

  get textureCursor(): Vec2 | null {
    return this.#textureCursor ? { ...this.#textureCursor } : null;
  }

  get pansOnPrimary(): boolean {
    return this.#panHeld || this.#active.pansOnPrimary;
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
    this.#syncCursor();
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

  onPointerDown(
    slot: BrushColorSlot,
    position: PointerPosition,
    ctrlKey: boolean
  ): boolean {
    const tracked = this.#active.onPointerDown(
      slot,
      position,
      ctrlKey
    );
    this.#syncCursor();

    return tracked;
  }

  onPointerMove(
    slot: BrushColorSlot,
    position: PointerPosition
  ): void {
    this.#active.onPointerMove(slot, position);
  }

  onPointerUp(
    slot: BrushColorSlot
  ): void {
    this.#active.onPointerUp(slot);
    this.#syncCursor();
  }

  onCtrlWheel(
    delta: number
  ): boolean {
    return this.#active.onCtrlWheel(delta);
  }

  onPanStart(): void {
    this.#isPanning = true;
    this.#syncCursor();
  }

  onPanEnd(): void {
    this.#isPanning = false;
    this.#syncCursor();
  }

  onHover(
    position: PointerPosition | null
  ): void {
    this.#active.onHover(position?.canvas ?? null);
    this.#syncCursor();

    const textureCursor = position?.boundedTexture ?? null;
    this.#textureCursor = textureCursor;
    this.#active.onCursorMove(textureCursor);
    this.onExternalCursorMove?.(textureCursor);
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

  selectAll(): boolean {
    const handled = this.#active.onSelectAll();
    if (handled) {
      this.#syncCursor();
    }

    return handled;
  }

  delete(): boolean {
    return this.#active.onDelete();
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

  #modeOf(
    id: Mode
  ): InteractionMode {
    const mode = this.#modes.get(id);
    if (!mode) {
      throw new Error(`Unknown mode: "${id}"`);
    }

    return mode;
  }

  #activate(
    mode: InteractionMode
  ): void {
    const previous = this.#active;
    previous.onExit();
    this.#active = mode;
    this.#syncCursor();
    this.#onModeChange?.(mode.id, previous.id);
  }

  #cursor(): string {
    if (this.#isPanning) {
      return "grabbing";
    }

    return this.#panHeld ? "grab" : this.#active.cursor();
  }

  #syncCursor(): void {
    this.#setCursor(this.#cursor());
  }
}
