// Import Third-party Dependencies
import {
  LitElement,
  html
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import {
  FieldBinding,
  PopoverController,
  type ContextMenuEntry
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/color-picker";
import "@jolly-pixel/ui/elements/context-menu";
import type { ContextMenu } from "@jolly-pixel/ui/elements/context-menu";
import {
  formatHex,
  shadeRamp,
  type ColorSortKey
} from "@jolly-pixel/color";
import { ColorPalette } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  colorWithOpacity,
  pickerSource
} from "./pickerChange.ts";
import type { ColorChangeDetail } from "./ColorSwatch.ts";
import type {
  PaletteContextDetail,
  PaletteSelectDetail
} from "./ColorPaletteGrid.ts";
import type { PaletteAction } from "./PaletteAction.ts";
import type { PaletteSelection } from "./PaletteSelection.ts";
import {
  PaletteState,
  type PaletteEdit
} from "./PaletteState.ts";
import "./ColorPaletteGrid.ts";
import "./ColorStrip.ts";
import { colorDockStyles } from "./ColorDock.styles.ts";
import { iconStyles } from "../shared/icon.styles.ts";
import {
  renderIcon,
  type GlyphName
} from "../shared/icons.ts";

// CONSTANTS
const kDefaultPalette = ColorPalette.create();
const kShadeCount = 3;
const kSortKeys: readonly { key: ColorSortKey; label: string; }[] = [
  { key: "hue", label: "Hue" },
  { key: "chroma", label: "Chroma" },
  { key: "lightness", label: "Lightness" },
  { key: "alpha", label: "Alpha" }
];
const kTools: readonly PaletteTool[] = [
  {
    icon: "add",
    label: "Add the active color",
    action: { type: "add" }
  },
  {
    icon: "ramp",
    label: "Ramp between the ends of the selected range",
    action: { type: "ramp" }
  },
  {
    icon: "copy",
    label: "Duplicate the selected colors",
    action: { type: "duplicate" }
  },
  {
    icon: "trash",
    label: "Delete the selected colors",
    action: { type: "remove" }
  }
];
const kMenuActions = new Map<string, PaletteAction>([
  ["ramp", { type: "ramp" }],
  ["reverse", { type: "reverse" }],
  ["duplicate", { type: "duplicate" }],
  ["remove", { type: "remove" }],
  ["from-texture", { type: "from-texture" }],
  ["load", { type: "load" }],
  ["save:gpl", { type: "save", format: "gpl" }],
  ["save:hex", { type: "save", format: "hex" }],
  ...kSortKeys.map(({ key }): [string, PaletteAction] => [
    `sort:${key}`,
    { type: "sort", key }
  ])
]);

interface PaletteTool {
  icon: GlyphName;
  label: string;
  action: Extract<PaletteAction, { type: PaletteEdit["type"]; }>;
}

@customElement("color-dock")
export class ColorDock extends LitElement {
  static override styles = [
    iconStyles,
    colorDockStyles
  ];

  @property({ type: String })
  declare color: string;

  @property({ type: Number })
  declare opacity: number;

  @property({ attribute: false })
  declare palette: ColorPalette | null;

  @property({ attribute: false })
  declare selection: PaletteSelection | null;

  @property({ attribute: false })
  declare editing: number | null;

  @property({ type: Boolean, attribute: "palette-locked" })
  declare paletteLocked: boolean;

  @property({ attribute: false })
  declare recent: readonly ColorChangeDetail[];

  #picker = new FieldBinding(this, pickerSource(this));
  #menu = createRef<ContextMenu>();
  #stripsToggle = createRef<HTMLButtonElement>();
  #stripsPopover = createRef<HTMLElement>();
  #stripsPopup = new PopoverController(this, {
    anchor: () => this.#stripsToggle.value ?? null,
    popover: () => this.#stripsPopover.value ?? null,
    side: "above",
    align: "end"
  });

  constructor() {
    super();

    this.color = "#000000";
    this.opacity = 1;
    this.palette = null;
    this.selection = null;
    this.editing = null;
    this.paletteLocked = false;
    this.recent = [];
  }

  override render() {
    const state = this.#state();
    const strips = this.#renderStrips();

    return html`
      <div class="palette" part="palette-section">
        ${this.#renderTools(state)}
        <color-palette-grid
          part="palette"
          .palette=${state.palette}
          .selection=${this.selection}
          .editing=${this.editing}
          .disabled=${this.palette === null}
          .locked=${this.paletteLocked}
          @palette-context=${this.#onContext}
        ></color-palette-grid>
      </div>
      <jolly-color-picker
        layout="wide"
        alpha
        settings
        eyedropper
        part="picker"
        .value=${this.#picker.value}
        @jolly-input=${this.#picker.input}
        @jolly-change=${this.#picker.commit}
      ></jolly-color-picker>
      <div class="strips" part="strips">${strips}</div>
      <button
        ${ref(this.#stripsToggle)}
        type="button"
        class="tool strips-toggle"
        part="strips-toggle"
        title="Shades and recent colors"
        aria-label="Shades and recent colors"
        aria-haspopup="dialog"
        aria-expanded=${String(this.#stripsPopup.open)}
        @click=${() => this.#toggleStrips()}
      >${renderIcon("ramp")}</button>
      <div
        ${ref(this.#stripsPopover)}
        class="strips-popover"
        part="strips-popover"
        popover
        role="dialog"
        aria-label="Shades and recent colors"
        @beforetoggle=${this.#stripsPopup.onBeforeToggle}
        @toggle=${(event: ToggleEvent) => {
          this.#stripsPopup.onToggle(event);
          this.requestUpdate();
        }}
      >${strips}</div>
      <jolly-context-menu
        ${ref(this.#menu)}
        label="Palette actions"
        @jolly-context-action=${this.#onMenuAction}
      ></jolly-context-menu>
    `;
  }

  #renderTools(
    state: PaletteState
  ) {
    return html`
      <div
        class="palette-tools"
        role="toolbar"
        aria-label="Palette"
        aria-orientation="vertical"
        part="palette-tools"
      >
        ${kTools.map((tool) => html`
          <button
            type="button"
            class="tool"
            title=${tool.label}
            aria-label=${tool.label}
            ?disabled=${!this.#allows(state, tool.action.type)}
            @click=${() => this.#emit(tool.action)}
          >${renderIcon(tool.icon)}</button>
        `)}
        <button
          type="button"
          class="tool"
          title="More palette actions"
          aria-label="More palette actions"
          aria-haspopup="menu"
          ?disabled=${this.palette === null}
          @click=${(event: MouseEvent) => {
            if (event.currentTarget instanceof HTMLElement) {
              const box = event.currentTarget.getBoundingClientRect();
              this.#openMenu(box.left, box.top);
            }
          }}
        >${renderIcon("more")}</button>
      </div>
    `;
  }

  #renderStrips() {
    const addable = this.#editable;

    return html`
      <color-strip
        label="Shades"
        part="shades"
        .colors=${this.#shades()}
        .current=${kShadeCount}
        .addable=${addable}
      ></color-strip>
      <color-strip
        label="Recent"
        part="recent"
        .colors=${this.recent}
        .addable=${addable}
      ></color-strip>
    `;
  }

  #toggleStrips(): void {
    if (this.#stripsPopup.open) {
      this.#stripsPopup.hide();
    }
    else {
      this.#stripsPopup.show();
    }
  }

  #shades(): ColorChangeDetail[] {
    return shadeRamp(colorWithOpacity(this.color, this.opacity), {
      shades: kShadeCount,
      tints: kShadeCount
    }).map((color) => {
      return {
        hex: formatHex(color),
        opacity: color.a
      };
    });
  }

  #menuItems(): ContextMenuEntry[] {
    const state = this.#state();
    const editable = this.#editable;
    const scope = state.scope;

    return [
      {
        id: "ramp",
        label: "Ramp",
        disabled: !this.#allows(state, "ramp")
      },
      {
        id: "sort",
        label: `Sort ${scope} by`,
        disabled: !editable,
        items: kSortKeys.map(({ key, label }) => {
          return { id: `sort:${key}`, label };
        })
      },
      {
        id: "reverse",
        label: `Reverse ${scope}`,
        disabled: !editable
      },
      {
        id: "duplicate",
        label: "Duplicate",
        disabled: !this.#allows(state, "duplicate")
      },
      {
        id: "remove",
        label: "Delete",
        intent: "danger",
        disabled: !this.#allows(state, "remove")
      },
      "separator",
      {
        id: "from-texture",
        label: "Palette from texture",
        disabled: !editable
      },
      {
        id: "load",
        label: "Load palette…",
        disabled: !editable
      },
      {
        id: "save",
        label: "Save palette as",
        items: [
          { id: "save:gpl", label: "GIMP palette (.gpl)" },
          { id: "save:hex", label: "Hex list (.hex)" }
        ]
      }
    ];
  }

  #openMenu(
    x: number,
    y: number
  ): void {
    const menu = this.#menu.value;
    if (menu) {
      menu.items = this.#menuItems();
      menu.openAt(x, y);
    }
  }

  readonly #onContext = (
    event: CustomEvent<PaletteContextDetail>
  ): void => {
    const { index, x, y } = event.detail;
    if (!this.selection?.includes(index)) {
      this.dispatchEvent(new CustomEvent<PaletteSelectDetail>("palette-select", {
        bubbles: true,
        composed: true,
        detail: { index, extend: false }
      }));
    }
    void this.updateComplete.then(() => this.#openMenu(x, y));
  };

  readonly #onMenuAction = (
    event: CustomEvent<{ id: string; }>
  ): void => {
    const action = kMenuActions.get(event.detail.id);
    if (action !== undefined) {
      this.#emit(action);
    }
  };

  get #editable(): boolean {
    return this.palette !== null && !this.paletteLocked;
  }

  #state(): PaletteState {
    return new PaletteState(this.palette ?? kDefaultPalette, this.selection);
  }

  #allows(
    state: PaletteState,
    type: PaletteEdit["type"]
  ): boolean {
    return this.#editable && state.allows(type);
  }

  #emit(
    action: PaletteAction
  ): void {
    this.dispatchEvent(new CustomEvent<PaletteAction>("palette-action", {
      bubbles: true,
      composed: true,
      detail: action
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-dock": ColorDock;
  }
}
