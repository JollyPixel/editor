// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import {
  ColorPalette,
  type PixelArtCanvas,
  type PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";
import {
  rgba8ToColorChange,
  colorChangeToRgba8
} from "./pickerChange.ts";

// CONSTANTS
const kDefaultPalette = ColorPalette.create();
const kKeepsSelection =
  "color-dock, color-picker-popover, [data-option='pickColor']";

export interface PaletteControllerOptions {
  canvas: () => PixelArtCanvas | null;
  onDocumentChange: () => void;
  onSelectedColorChange: (color: ColorChangeDetail) => void;
  onDismiss: () => void;
}

export class PaletteController implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #options: PaletteControllerOptions;
  readonly #selected = new WeakMap<PixelDocument, number>();
  #document: PixelDocument | null = null;
  #unsubscribe: (() => void) | null = null;
  locked = false;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    options: PaletteControllerOptions
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  get palette(): ColorPalette | null {
    return this.#activeDocument()?.palette ?? null;
  }

  get selected(): number | null {
    const doc = this.#activeDocument();

    return doc === null ? null : this.#selected.get(doc) ?? null;
  }

  hostConnected(): void {
    document.addEventListener("pointerdown", this.#onPointerDown, true);
    this.#bind();
  }

  hostUpdate(): void {
    this.#bind();
  }

  hostDisconnected(): void {
    document.removeEventListener("pointerdown", this.#onPointerDown, true);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#document = null;
  }

  colorAt(
    index: number
  ): ColorChangeDetail {
    const palette = this.palette ?? kDefaultPalette;

    return rgba8ToColorChange(palette.colorAt(index));
  }

  selectedColor(
    doc = this.#activeDocument()
  ): ColorChangeDetail | null {
    if (doc === null) {
      return null;
    }
    const index = this.#selected.get(doc);

    return index === undefined ?
      null :
      rgba8ToColorChange(doc.palette.colorAt(index));
  }

  select(
    index: number
  ): ColorChangeDetail | null {
    const doc = this.#activeDocument();
    if (doc === null) {
      return null;
    }
    this.#selected.set(doc, index);

    return rgba8ToColorChange(doc.palette.colorAt(index));
  }

  deselect(): void {
    const doc = this.#activeDocument();
    if (doc !== null) {
      this.#selected.delete(doc);
    }
  }

  commit(
    color: ColorChangeDetail
  ): void {
    if (this.locked) {
      this.deselect();

      return;
    }

    const index = this.selected;
    if (index !== null) {
      this.#activeDocument()?.changePaletteColor(index, colorChangeToRgba8(color));
    }
  }

  #activeDocument(): PixelDocument | null {
    return this.#options.canvas()?.document ?? null;
  }

  #bind(): void {
    const doc = this.#activeDocument();
    if (doc === this.#document) {
      return;
    }
    this.#unsubscribe?.();
    this.#document = doc;
    this.#unsubscribe = doc?.subscribe(
      "palette-changed",
      this.#onPaletteChanged
    ) ?? null;
    this.#options.onDocumentChange();
  }

  readonly #onPaletteChanged = (
    index: number | null
  ): void => {
    const selected = this.selected;
    if (selected !== null && (index === null || index === selected)) {
      this.#options.onSelectedColorChange(this.colorAt(selected));
    }
    this.#host.requestUpdate();
  };

  readonly #onPointerDown = (
    event: PointerEvent
  ): void => {
    const canvas = this.#options.canvas();
    if (canvas === null || this.selected === null) {
      return;
    }
    const path = event.composedPath();
    const keepsSelection = path.includes(canvas.canvas()) || (
      path.includes(this.#host) &&
      path.some((target) => (
        target instanceof Element && target.matches(kKeepsSelection)
      ))
    );
    if (!keepsSelection) {
      this.#options.onDismiss();
    }
  };
}
