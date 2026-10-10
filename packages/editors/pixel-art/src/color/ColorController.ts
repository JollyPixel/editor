// Import Third-party Dependencies
import {
  html,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import {
  createRef,
  ref
} from "lit/directives/ref.js";
import type {
  BrushColorSlot,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  ColorPickerPopover,
  ColorPickerRequest
} from "./ColorPickerPopover.ts";
import type { PaletteEditDetail } from "./ColorPaletteGrid.ts";
import type { ColorChangeDetail } from "./ColorSwatch.ts";
import { PaletteController } from "./PaletteController.ts";
import {
  readBrushColor,
  writeBrushColor
} from "./brushColor.ts";

// CONSTANTS
const kDefaultForeground: ColorChangeDetail = {
  hex: "#000000",
  opacity: 1
};
const kDefaultBackground: ColorChangeDetail = {
  hex: "#ffffff",
  opacity: 1
};

export interface ColorPickedDetail extends ColorChangeDetail {
  slot?: BrushColorSlot;
}

interface ColorDraft {
  color: ColorChangeDetail;
  canvas: PixelArtCanvas | null;
}

export class ColorController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #canvas: () => PixelArtCanvas | null;
  readonly #palette: PaletteController;
  readonly #picker = createRef<ColorPickerPopover>();
  #docked = false;
  #undockedBackground: ColorChangeDetail | null = null;
  #draft: ColorDraft | null = null;
  #editing: number | null = null;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    canvas: () => PixelArtCanvas | null
  ) {
    this.#host = host;
    this.#canvas = canvas;
    host.addController(this);
    this.#palette = new PaletteController(host, {
      canvas,
      onDocumentChange: () => this.#onDocumentChange(),
      onSelectedColorChange: (color) => {
        if (this.#docked && this.#draft === null) {
          this.#applyActive(color);
        }
      },
      onDismiss: () => this.deselectPaletteColor()
    });
  }

  hostConnected(): void {
    this.#host.addEventListener("color-picker-open", this.#onPickerOpen);
    this.#host.addEventListener("color-picker-close", this.#onPickerClose);
  }

  hostUpdated(): void {
    this.#picker.value?.refresh();
  }

  hostDisconnected(): void {
    this.#host.removeEventListener("color-picker-open", this.#onPickerOpen);
    this.#host.removeEventListener("color-picker-close", this.#onPickerClose);
    this.#picker.value?.close();
    this.cancelDraft();
  }

  get foreground(): ColorChangeDetail {
    const brush = this.#canvas()?.brush;

    return brush ? readBrushColor(brush.primary) : kDefaultForeground;
  }

  get background(): ColorChangeDetail {
    const brush = this.#canvas()?.brush;

    return brush ? readBrushColor(brush.secondary) : kDefaultBackground;
  }

  get docked(): boolean {
    return this.#docked;
  }

  set docked(
    value: boolean
  ) {
    if (value === this.#docked) {
      return;
    }

    this.#picker.value?.close();
    this.cancelDraft();
    this.#docked = value;
    if (value) {
      this.#dock();
    }
    else {
      const background = this.#undockedBackground ?? this.foreground;
      this.#undockedBackground = null;
      this.#write("secondary", background);
    }
    this.#host.requestUpdate();
  }

  get paletteLocked(): boolean {
    return this.#palette.locked;
  }

  set paletteLocked(
    locked: boolean
  ) {
    if (locked === this.#palette.locked) {
      return;
    }

    this.#palette.locked = locked;
    if (locked && this.#editing !== null) {
      this.#picker.value?.close();
    }
    this.#host.requestUpdate();
  }

  adopt(): void {
    if (this.#docked) {
      this.#dock();
    }
  }

  selectPaletteColor(
    index: number
  ): void {
    this.#picker.value?.close();
    this.cancelDraft();
    const color = this.#palette.select(index);
    if (color !== null) {
      this.#applyActive(color);
      this.#host.requestUpdate();
    }
  }

  deselectPaletteColor(): void {
    if (this.#palette.selected === null) {
      return;
    }
    this.#picker.value?.close();
    this.cancelDraft();
    this.#palette.deselect();
    this.#host.requestUpdate();
  }

  changeForeground(
    color: ColorChangeDetail
  ): void {
    if (this.#docked) {
      this.changeActive(color);

      return;
    }

    this.#write("primary", color);
    this.#host.requestUpdate();
  }

  changeBackground(
    color: ColorChangeDetail
  ): void {
    if (this.#docked) {
      return;
    }

    this.#write("secondary", color);
    this.#host.requestUpdate();
  }

  previewActive(
    color: ColorChangeDetail
  ): void {
    this.#draft ??= {
      color: this.foreground,
      canvas: this.#canvas()
    };
    this.#applyActive(color);
    this.#host.requestUpdate();
  }

  changeActive(
    color: ColorChangeDetail
  ): void {
    this.#draft = null;
    this.#applyActive(color);
    this.#palette.commit(color);
    this.#host.requestUpdate();
  }

  cancelDraft(): void {
    const draft = this.#draft;
    if (draft === null) {
      return;
    }

    this.#draft = null;
    if (draft.canvas !== null) {
      const { document: doc, brush } = draft.canvas;
      const color = this.#palette.selectedColor(doc) ?? draft.color;
      writeBrushColor(brush.primary, color);
      writeBrushColor(brush.secondary, color);
    }
    this.#host.requestUpdate();
  }

  swap(): void {
    if (this.#docked) {
      return;
    }

    this.#canvas()?.brush.swapColors();
    this.#host.requestUpdate();
  }

  onColorPicked(
    detail: ColorPickedDetail
  ): void {
    if (this.#docked) {
      this.changeActive({
        hex: detail.hex,
        opacity: detail.opacity
      });
    }
    this.#host.requestUpdate();
  }

  renderPopover(): TemplateResult {
    return html`
      <color-picker-popover
        part="color-picker-popover"
        ${ref(this.#picker)}
      ></color-picker-popover>
    `;
  }

  renderDock(): TemplateResult {
    const { hex, opacity } = this.foreground;

    return html`
      <color-dock
        class="color-dock"
        part="color-dock"
        ?open=${this.#docked}
        ?inert=${!this.#docked}
        .color=${hex}
        .opacity=${opacity}
        .palette=${this.#palette.palette}
        .selected=${this.#palette.selected}
        .editing=${this.#editing}
        .paletteLocked=${this.#palette.locked}
        @palette-select=${(event: CustomEvent<number>) => {
          this.selectPaletteColor(event.detail);
        }}
        @palette-edit=${(event: CustomEvent<PaletteEditDetail>) => {
          this.#editPaletteColor(event.detail);
        }}
        @color-preview=${(event: CustomEvent<ColorChangeDetail>) => {
          if (this.#docked) {
            this.previewActive(event.detail);
          }
        }}
        @color-change=${(event: CustomEvent<ColorChangeDetail>) => {
          if (this.#docked) {
            this.changeActive(event.detail);
          }
        }}
      ></color-dock>
    `;
  }

  readonly #onPickerOpen = (
    event: CustomEvent<ColorPickerRequest>
  ): void => {
    this.#picker.value?.open(event.detail);
  };

  readonly #onPickerClose = (
    event: CustomEvent<HTMLButtonElement>
  ): void => {
    this.#picker.value?.close(event.detail);
  };

  #editPaletteColor(
    detail: PaletteEditDetail
  ): void {
    const { index, anchor } = detail;
    this.selectPaletteColor(index);
    this.#editing = index;
    this.#picker.value?.open({
      anchor,
      label: "Edit palette color",
      side: "above",
      color: () => this.#palette.colorAt(index),
      change: (color, last) => {
        if (last) {
          this.changeActive(color);
        }
        else {
          this.previewActive(color);
        }
      },
      close: () => {
        this.#editing = null;
        this.cancelDraft();
      }
    });
    this.#host.requestUpdate();
  }

  #onDocumentChange(): void {
    const draftCanvas = this.#draft?.canvas ?? null;
    this.#picker.value?.close();
    this.cancelDraft();
    if (!this.#docked) {
      return;
    }

    if (draftCanvas !== null) {
      this.#applyActive(readBrushColor(draftCanvas.brush.primary));
    }
    const selected = this.#palette.selectedColor();
    if (selected !== null) {
      this.#applyActive(selected);
    }
  }

  #dock(): void {
    this.#undockedBackground = this.background;
    this.#applyActive(this.foreground);
  }

  #applyActive(
    color: ColorChangeDetail
  ): void {
    this.#write("primary", color);
    this.#write("secondary", color);
  }

  #write(
    slot: BrushColorSlot,
    color: ColorChangeDetail
  ): void {
    const brush = this.#canvas()?.brush;
    if (brush) {
      writeBrushColor(brush[slot], color);
    }
  }
}
