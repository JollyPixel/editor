// Import Third-party Dependencies
import {
  formatHex8,
  formatRgba8
} from "@jolly-pixel/color";
import { ColorPalette } from "@jolly-pixel/pixel-draw.renderer";
import {
  LitElement,
  html,
  nothing,
  type PropertyValues
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

// Import Internal Dependencies
import { colorPaletteGridStyles } from "./ColorPaletteGrid.styles.ts";
import type { PaletteDropDetail } from "./PaletteAction.ts";
import type { PaletteSelection } from "./PaletteSelection.ts";

// CONSTANTS
const kRows = 5;
const kMinColumns = 2;
const kLockedHint = "click to use";
const kEditHint = "click to use, shift click to select a range, " +
  "double click or F2 to edit, drag to move, Ctrl drag to copy";

export interface PaletteSelectDetail {
  index: number;
  extend: boolean;
}

export interface PaletteEditDetail {
  index: number;
  anchor: HTMLButtonElement;
}

export interface PaletteContextDetail {
  index: number;
  x: number;
  y: number;
}

@customElement("color-palette-grid")
export class ColorPaletteGrid extends LitElement {
  static override styles = colorPaletteGridStyles;

  @property({ attribute: false })
  declare palette: ColorPalette;

  @property({ attribute: false })
  declare selection: PaletteSelection | null;

  @property({ attribute: false })
  declare editing: number | null;

  @property({ type: Boolean })
  declare disabled: boolean;

  @property({ type: Boolean })
  declare locked: boolean;

  @state()
  declare _dropTarget: number | null;

  #dragFrom: number | null = null;

  constructor() {
    super();
    this.palette = ColorPalette.create();
    this.selection = null;
    this.editing = null;
    this.disabled = false;
    this.locked = false;
    this._dropTarget = null;
  }

  protected override updated(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("selection") && this.selection !== null) {
      this.renderRoot
        .querySelector("button[aria-pressed='true']")
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  override render() {
    const { size } = this.palette;
    const columns = Math.max(kMinColumns, Math.ceil(size / kRows));
    const hint = this.locked ? kLockedHint : kEditHint;
    const editable = !this.locked && !this.disabled;

    return html`
      <div
        class="grid"
        role="group"
        aria-label="Document color palette"
        style=${`--palette-columns:${columns}`}
      >
        ${this.palette.toJSON().map((color, index) => html`
          <button
            type="button"
            part="palette-slot"
            class=${classMap({
              "in-range": this.selection?.multiple === true && this.selection.includes(index),
              "drop-target": this._dropTarget === index
            })}
            aria-label=${`Palette color ${index + 1}`}
            aria-pressed=${String(this.selection?.focus === index)}
            aria-haspopup=${this.locked ? nothing : "dialog"}
            aria-expanded=${this.locked ? nothing : String(this.editing === index)}
            title=${`${formatHex8(color, true)}: ${hint}`}
            draggable=${editable ? "true" : "false"}
            ?disabled=${this.disabled}
            style=${`--swatch-color:${formatRgba8(color)}`}
            @click=${(event: MouseEvent) => this.#select(event, index)}
            @dblclick=${(event: MouseEvent) => this.#edit(event, index)}
            @contextmenu=${(event: MouseEvent) => this.#context(event, index)}
            @keydown=${(event: KeyboardEvent) => {
              if (event.key === "F2") {
                event.preventDefault();
                this.#edit(event, index);
              }
            }}
            @dragstart=${(event: DragEvent) => this.#dragStart(event, index)}
            @dragover=${(event: DragEvent) => this.#dragOver(event, index)}
            @dragleave=${() => this.#dragLeave(index)}
            @drop=${(event: DragEvent) => this.#drop(event, index)}
            @dragend=${() => this.#dragEnd()}
          ></button>
        `)}
      </div>
    `;
  }

  #select(
    event: MouseEvent,
    index: number
  ): void {
    this.#dispatch<PaletteSelectDetail>("palette-select", {
      index,
      extend: event.shiftKey && this.selection !== null
    });
  }

  #edit(
    event: Event,
    index: number
  ): void {
    if (!this.locked && event.currentTarget instanceof HTMLButtonElement) {
      this.#dispatch<PaletteEditDetail>("palette-edit", {
        index,
        anchor: event.currentTarget
      });
    }
  }

  #context(
    event: MouseEvent,
    index: number
  ): void {
    if (this.disabled) {
      return;
    }

    event.preventDefault();
    if (event.currentTarget instanceof HTMLButtonElement) {
      event.currentTarget.focus();
    }
    this.#dispatch<PaletteContextDetail>("palette-context", {
      index,
      x: event.clientX,
      y: event.clientY
    });
  }

  #dragStart(
    event: DragEvent,
    index: number
  ): void {
    if (this.locked || this.disabled || event.dataTransfer === null) {
      event.preventDefault();

      return;
    }

    this.#dragFrom = index;
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/plain", String(index));
  }

  #dragOver(
    event: DragEvent,
    index: number
  ): void {
    if (this.#dragFrom === null) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = isCopy(event) ? "copy" : "move";
    }
    this._dropTarget = index;
  }

  #dragLeave(
    index: number
  ): void {
    if (this._dropTarget === index) {
      this._dropTarget = null;
    }
  }

  #drop(
    event: DragEvent,
    index: number
  ): void {
    const from = this.#dragFrom;
    this.#dragEnd();
    if (from === null) {
      return;
    }

    event.preventDefault();
    this.#dispatch<PaletteDropDetail>("palette-drop", {
      from,
      to: index,
      copy: isCopy(event)
    });
  }

  #dragEnd(): void {
    this.#dragFrom = null;
    this._dropTarget = null;
  }

  #dispatch<TDetail>(
    type: string,
    detail: TDetail
  ): void {
    this.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      composed: true,
      detail
    }));
  }
}

function isCopy(
  event: DragEvent
): boolean {
  return event.ctrlKey || event.metaKey;
}

declare global {
  interface HTMLElementTagNameMap {
    "color-palette-grid": ColorPaletteGrid;
  }
}
