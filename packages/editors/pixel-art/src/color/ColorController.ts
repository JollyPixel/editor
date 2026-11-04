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
import {
  COLOR_PALETTE_MAX_SIZE,
  type BrushColorSlot,
  type PixelArtCanvas,
  type RGBA8
} from "@jolly-pixel/pixel-draw.renderer";
import type { PaletteFormat } from "@jolly-pixel/color";
import type { JollyChangeDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  ColorPickerPopover,
  ColorPickerRequest
} from "./ColorPickerPopover.ts";
import type {
  PaletteEditDetail,
  PaletteSelectDetail
} from "./ColorPaletteGrid.ts";
import type {
  PaletteAction,
  PaletteDropDetail,
  StripPickDetail
} from "./PaletteAction.ts";
import { PaletteTransfer } from "./PaletteTransfer.ts";
import {
  colorChangeToRgba8,
  parseColorChange
} from "./pickerChange.ts";
import type { ColorChangeDetail } from "./ColorSwatch.ts";
import { PaletteController } from "./PaletteController.ts";
import type { PaletteRampSpace } from "./PaletteState.ts";
import { RecentColors } from "./RecentColors.ts";
import {
  readBrushColor,
  writeBrushColor
} from "./brushColor.ts";
import type { TextureEvents } from "../textures/TextureSet.ts";

// CONSTANTS
const kDefaultForeground: ColorChangeDetail = {
  hex: "#000000",
  opacity: 1
};
const kDefaultBackground: ColorChangeDetail = {
  hex: "#ffffff",
  opacity: 1
};
const kActiveSlots: readonly BrushColorSlot[] = ["primary", "secondary"];
const kTextureColorProbe = COLOR_PALETTE_MAX_SIZE + 1;

export interface ColorPickedDetail extends ColorChangeDetail {
  slot?: BrushColorSlot;
}

interface ColorDraft {
  color: ColorChangeDetail;
  canvas: PixelArtCanvas | null;
}

export interface ColorControllerOptions {
  notify: (message: string) => void;
  rampSpace: () => PaletteRampSpace;
}

export class ColorController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #canvas: () => PixelArtCanvas | null;
  readonly #palette: PaletteController;
  readonly #picker = createRef<ColorPickerPopover>();
  readonly #options: ColorControllerOptions;
  #recent = RecentColors.empty;
  #docked = false;
  #undockedBackground: ColorChangeDetail | null = null;
  #draft: ColorDraft | null = null;
  #editing: number | null = null;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    canvas: () => PixelArtCanvas | null,
    events: TextureEvents,
    options: ColorControllerOptions
  ) {
    this.#host = host;
    this.#canvas = canvas;
    this.#options = options;
    host.addController(this);
    this.#palette = new PaletteController(host, {
      canvas,
      events,
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

  get recentColors(): readonly ColorChangeDetail[] {
    return this.#recent.colors;
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

  extendPaletteSelection(
    index: number
  ): void {
    this.#picker.value?.close();
    this.cancelDraft();
    const color = this.#palette.extend(index);
    if (color !== null) {
      this.#applyActive(color);
      this.#host.requestUpdate();
    }
  }

  stepPaletteColor(
    offset: number
  ): boolean {
    if (!this.#docked) {
      return false;
    }

    this.#picker.value?.close();
    this.cancelDraft();
    const color = this.#palette.step(offset);
    if (color === null) {
      return false;
    }
    this.#applyActive(color);
    this.#host.requestUpdate();

    return true;
  }

  editPalette(
    action: PaletteAction
  ): void {
    this.#picker.value?.close();
    this.cancelDraft();
    switch (action.type) {
      case "add":
        this.#palette.apply({
          type: "add",
          color: colorChangeToRgba8(this.foreground)
        });
        break;
      case "ramp":
        this.#palette.apply({
          type: "ramp",
          space: this.#options.rampSpace()
        });
        break;
      case "save":
        this.#savePalette(action.format);
        break;
      case "load":
        void this.#loadPalette();
        break;
      case "from-texture":
        this.#paletteFromTexture();
        break;
      default:
        this.#palette.apply(action);
    }
    this.#host.requestUpdate();
  }

  dropPaletteColors(
    detail: PaletteDropDetail
  ): void {
    this.#picker.value?.close();
    this.cancelDraft();
    this.#palette.apply({
      type: "drop",
      ...detail
    });
  }

  pickStripColor(
    detail: StripPickDetail
  ): void {
    const color: ColorChangeDetail = {
      hex: detail.hex,
      opacity: detail.opacity
    };
    if (detail.add) {
      this.#picker.value?.close();
      this.cancelDraft();
      this.#palette.apply({
        type: "add",
        color: colorChangeToRgba8(color)
      });

      return;
    }

    this.deselectPaletteColor();
    this.#draft = null;
    this.#use(color, kActiveSlots);
    this.#host.requestUpdate();
  }

  pickSecondary(
    value: string
  ): void {
    const color = parseColorChange(value);
    if (color !== null) {
      this.changeBackground(color);
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

    this.#use(color, ["primary"]);
    this.#host.requestUpdate();
  }

  changeBackground(
    color: ColorChangeDetail
  ): void {
    if (this.#docked) {
      return;
    }

    this.#use(color, ["secondary"]);
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
    this.#use(color, kActiveSlots);
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
    const color = {
      hex: detail.hex,
      opacity: detail.opacity
    };
    if (this.#docked) {
      this.changeActive(color);
    }
    else {
      this.#use(color, [detail.slot ?? "primary"]);
    }
    this.#host.requestUpdate();
  }

  renderPopover(): TemplateResult {
    return html`
      <color-picker-popover
        part="color-picker-popover"
        ${ref(this.#picker)}
        @jolly-secondary=${this.#onSecondary}
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
        .selection=${this.#palette.selection}
        .editing=${this.#editing}
        .paletteLocked=${this.#palette.locked}
        .recent=${this.#recent.colors}
        @palette-select=${(event: CustomEvent<PaletteSelectDetail>) => {
          if (event.detail.extend) {
            this.extendPaletteSelection(event.detail.index);
          }
          else {
            this.selectPaletteColor(event.detail.index);
          }
        }}
        @palette-edit=${(event: CustomEvent<PaletteEditDetail>) => {
          this.#editPaletteColor(event.detail);
        }}
        @palette-action=${(event: CustomEvent<PaletteAction>) => {
          this.editPalette(event.detail);
        }}
        @palette-drop=${(event: CustomEvent<PaletteDropDetail>) => {
          this.dropPaletteColors(event.detail);
        }}
        @strip-pick=${(event: CustomEvent<StripPickDetail>) => {
          this.pickStripColor(event.detail);
        }}
        @jolly-secondary=${this.#onSecondary}
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

  readonly #onSecondary = (
    event: CustomEvent<JollyChangeDetail<string>>
  ): void => {
    this.pickSecondary(event.detail.value);
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

  async #loadPalette(): Promise<void> {
    const file = await PaletteTransfer.open();
    if (file === null) {
      return;
    }

    try {
      const palette = await PaletteTransfer.read(file);
      this.#replacePalette(palette.colors, file.name);
    }
    catch (error) {
      this.#options.notify(
        error instanceof Error ? error.message : `Unable to read ${file.name}`
      );
    }
    this.#host.requestUpdate();
  }

  #savePalette(
    format: PaletteFormat
  ): void {
    const palette = this.#palette.palette;
    if (palette !== null) {
      PaletteTransfer.save(palette, format, "palette");
    }
  }

  #paletteFromTexture(): void {
    const colors = this.#palette.textureColors(kTextureColorProbe);
    if (colors.length === 0) {
      this.#options.notify("The texture has no visible colors");
    }
    else {
      this.#replacePalette(colors, "the texture");
    }
  }

  #replacePalette(
    colors: readonly RGBA8[],
    source: string
  ): void {
    this.#palette.apply({
      type: "replace",
      colors
    });
    if (colors.length > COLOR_PALETTE_MAX_SIZE) {
      this.#options.notify(
        `Kept the first ${COLOR_PALETTE_MAX_SIZE} colors of ${source}`
      );
    }
  }

  #use(
    color: ColorChangeDetail,
    slots: readonly BrushColorSlot[]
  ): void {
    for (const slot of slots) {
      this.#write(slot, color);
    }
    this.#recent = this.#recent.with(color);
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
