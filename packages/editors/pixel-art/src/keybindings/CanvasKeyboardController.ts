// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import {
  Keyboard,
  KeyBindingMap,
  type KeyboardGuard
} from "@jolly-pixel/controls";
import type { CanvasShortcuts } from "@jolly-pixel/pixel-draw.renderer";
import { inputLayers } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  PIXEL_ART_KEY_BINDINGS,
  type PixelArtKeyBindings
} from "./pixelArtKeyBindings.ts";

// CONSTANTS
export const CANVAS_HOVER_CHANGE_EVENT = "canvas-hover-change";

export interface CanvasHoverChangeDetail {
  hovering: boolean;
}

export type CanvasKeyboardHost = ReactiveControllerHost & EventTarget;

type HeldModifier = "panHeld" | "lineHeld";

export interface CanvasKeyboardControllerOptions {
  keyboard?: Keyboard;
  guard?: KeyboardGuard;
}

export class CanvasKeyboardController implements ReactiveController {
  readonly #host: CanvasKeyboardHost;
  readonly #shortcuts: () => CanvasShortcuts | null;
  readonly #keyboard: Keyboard;
  readonly #guard: KeyboardGuard;
  readonly #hoverGuard: KeyboardGuard = {
    blocks: () => !this.#hovering
  };
  #keyBindings: PixelArtKeyBindings = new KeyBindingMap(PIXEL_ART_KEY_BINDINGS);
  #connected = false;
  #releases: Array<() => void> = [];
  #releaseBindings: (() => void) | null = null;
  readonly #held = new Map<HeldModifier, CanvasShortcuts>();
  #hovering = false;

  constructor(
    host: CanvasKeyboardHost,
    shortcuts: () => CanvasShortcuts | null,
    options: CanvasKeyboardControllerOptions = {}
  ) {
    this.#host = host;
    this.#shortcuts = shortcuts;
    this.#keyboard = options.keyboard ?? new Keyboard({
      preventControlKeys: false
    });
    this.#guard = options.guard ?? inputLayers;
    host.addController(this);
  }

  get keyBindings(): PixelArtKeyBindings {
    return this.#keyBindings;
  }

  set keyBindings(
    keyBindings: PixelArtKeyBindings
  ) {
    this.#keyBindings = keyBindings;
    if (this.#connected) {
      this.#bind();
    }
  }

  hover(
    hovering: boolean
  ): void {
    this.#hovering = hovering;
    this.#host.dispatchEvent(new CustomEvent<CanvasHoverChangeDetail>(
      CANVAS_HOVER_CHANGE_EVENT,
      {
        bubbles: true,
        composed: true,
        detail: { hovering }
      }
    ));
  }

  hostConnected(): void {
    this.#connected = true;
    this.#keyboard.connect();
    this.#keyboard.on("down", this.#onKeyDown);
    this.#keyboard.on("up", this.#onKeyUp);
    this.#releases.push(
      this.#keyboard.addGuard(this.#guard),
      this.#keyboard.addGuard(this.#hoverGuard)
    );
    this.#bind();
  }

  hostDisconnected(): void {
    this.#connected = false;
    this.#releaseBindings?.();
    this.#releaseBindings = null;
    for (const release of this.#releases.splice(0)) {
      release();
    }
    this.#keyboard.off("down", this.#onKeyDown);
    this.#keyboard.off("up", this.#onKeyUp);
    this.#keyboard.disconnect();
    for (const modifier of [...this.#held.keys()]) {
      this.#release(modifier);
    }
  }

  #bind(): void {
    this.#releaseBindings?.();
    this.#releaseBindings = this.#keyBindings.bind(this.#keyboard, {
      copy: () => this.#shortcuts()?.copy() ?? false,
      paste: () => this.#shortcuts()?.paste() ?? false,
      undo: () => this.#shortcuts()?.undo() ?? false,
      redo: () => this.#shortcuts()?.redo() ?? false,
      delete: () => this.#shortcuts()?.delete() ?? false,
      rotate: () => this.#shortcuts()?.rotate("cw") ?? false,
      rotateCounterClockwise: () => this.#shortcuts()?.rotate("ccw") ?? false,
      flipHorizontal: () => this.#shortcuts()?.flipHorizontal() ?? false,
      flipVertical: () => this.#shortcuts()?.flipVertical() ?? false
    });
  }

  #hold(
    modifier: HeldModifier,
    shortcuts: CanvasShortcuts
  ): void {
    shortcuts[modifier] = true;
    this.#held.set(modifier, shortcuts);
  }

  #release(
    modifier: HeldModifier
  ): void {
    const shortcuts = this.#held.get(modifier);
    if (shortcuts !== undefined) {
      shortcuts[modifier] = false;
      this.#held.delete(modifier);
    }
  }

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const shortcuts = this.#shortcuts();
    if (shortcuts === null) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      this.#hold("panHeld", shortcuts);
    }
    else if (event.key === "Shift") {
      this.#hold("lineHeld", shortcuts);
    }
  };

  readonly #onKeyUp = (
    event: KeyboardEvent
  ): void => {
    if (event.code === "Space") {
      this.#release("panHeld");
    }
    else if (event.key === "Shift") {
      this.#release("lineHeld");
    }
  };
}
