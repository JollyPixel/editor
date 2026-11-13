// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import {
  ColorPalette,
  visibleColors,
  type PixelArtCanvas,
  type PixelDocument,
  type RGBA8
} from "@jolly-pixel/pixel-draw.renderer";
import { wrap } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";
import { PaletteSelection } from "./PaletteSelection.ts";
import {
  PaletteState,
  type PaletteEdit
} from "./PaletteState.ts";
import {
  rgba8ToColorChange,
  colorChangeToRgba8
} from "./pickerChange.ts";
import type { TextureEvents } from "../textures/TextureSet.ts";

// CONSTANTS
const kDefaultPalette = ColorPalette.create();
const kKeepsSelection =
  "color-dock, color-picker-popover, jolly-context-menu, [data-option='pickColor']";

export interface PaletteControllerOptions {
  canvas: () => PixelArtCanvas | null;
  events: TextureEvents;
  onDocumentChange: () => void;
  onSelectedColorChange: (color: ColorChangeDetail) => void;
  onDismiss: () => void;
}

export class PaletteController implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #options: PaletteControllerOptions;
  readonly #selected = new WeakMap<PixelDocument, PaletteSelection>();
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
    options.events.subscribe("active-change", () => this.#bind());
  }

  get palette(): ColorPalette | null {
    return this.#activeDocument()?.palette ?? null;
  }

  get selection(): PaletteSelection | null {
    const doc = this.#activeDocument();

    return doc === null ? null : this.#state(doc).selection;
  }

  get selected(): number | null {
    return this.selection?.focus ?? null;
  }

  hostConnected(): void {
    document.addEventListener("pointerdown", this.#onPointerDown, true);
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
    const selection = this.#state(doc).selection;

    return selection === null ?
      null :
      rgba8ToColorChange(doc.palette.colorAt(selection.focus));
  }

  select(
    index: number
  ): ColorChangeDetail | null {
    return this.#focus(PaletteSelection.at(index));
  }

  extend(
    index: number
  ): ColorChangeDetail | null {
    return this.#focus(
      this.selection?.extendTo(index) ?? PaletteSelection.at(index)
    );
  }

  step(
    offset: number
  ): ColorChangeDetail | null {
    const palette = this.palette;
    if (palette === null) {
      return null;
    }
    const current = this.selected ?? (offset > 0 ? -1 : 0);

    return this.select(wrap(current + offset, palette.size));
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

  apply(
    edit: PaletteEdit
  ): boolean {
    const doc = this.#activeDocument();
    if (doc === null || this.locked) {
      return false;
    }

    const state = this.#state(doc);
    const next = state.apply(edit);
    if (next === state) {
      return false;
    }

    if (next.selection === null) {
      this.#selected.delete(doc);
    }
    else {
      this.#selected.set(doc, next.selection);
    }
    doc.replacePalette(next.palette);
    this.#host.requestUpdate();

    return true;
  }

  textureColors(
    limit: number
  ): RGBA8[] {
    const doc = this.#activeDocument();

    return doc === null ?
      [] :
      visibleColors(doc.buffer.pixels({ copy: false }), limit);
  }

  #state(
    doc: PixelDocument
  ): PaletteState {
    return new PaletteState(doc.palette, this.#selected.get(doc) ?? null);
  }

  #focus(
    selection: PaletteSelection
  ): ColorChangeDetail | null {
    const doc = this.#activeDocument();
    if (doc === null) {
      return null;
    }
    this.#selected.set(doc, selection);

    return rgba8ToColorChange(doc.palette.colorAt(selection.focus));
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
