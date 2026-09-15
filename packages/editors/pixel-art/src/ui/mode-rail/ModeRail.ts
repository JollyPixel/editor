// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";
import "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  renderIcon,
  type IconName
} from "../common/icons.ts";
import { iconStyles } from "../common/icon.styles.ts";
import { railButtonStyles } from "./rail-button.styles.ts";
import type { UvAccess } from "../pixel-draw-panel/uvAccess.ts";

interface ModeItem {
  mode: Mode;
  icon: IconName;
  label: string;
}

interface FlyoutButton {
  icon: IconName;
  label: string;
  pressed?: boolean;
  onClick: () => void;
}

export interface ModeVariantDetail {
  mode: Mode;
  value: boolean;
}

// CONSTANTS
const kModeItems: ModeItem[] = [
  { mode: "move", icon: "move", label: "Move" },
  { mode: "paint", icon: "paint", label: "Paint" },
  { mode: "erase", icon: "eraser", label: "Erase" },
  { mode: "fill", icon: "fill", label: "Fill" },
  { mode: "select", icon: "select", label: "Select" },
  { mode: "uv", icon: "uv", label: "UV" }
];

@customElement("mode-rail")
export class ModeRail extends LitElement {
  static override styles = [
    iconStyles,
    railButtonStyles,
    css`
      jolly-rail {
        background: transparent;
      }

      .rail-item.open .rail-flyout,
      .rail-item:focus-within .rail-flyout {
        max-width: 84px;
      }

      .rail-badge {
        position: absolute;
        top: 1px;
        right: 1px;
        padding: 0 2px;
        border-radius: 3px;
        background: var(--color-bg-surface);
        color: var(--color-text-emphasis);
        font-size: 8px;
        font-weight: 700;
        line-height: 11px;
        pointer-events: none;
      }
    `
  ];

  @property({ type: String })
  declare mode: Mode;

  @property({ type: Boolean })
  declare pickColorArmed: boolean;

  @property({ type: Boolean })
  declare fillGlobal: boolean;

  @property({ type: Boolean })
  declare fillUvClip: boolean;

  @property({ type: Boolean })
  declare selectShape: boolean;

  @property({ type: String })
  declare uvAccess: UvAccess;

  #hoveredMode: Mode | null = null;

  constructor() {
    super();
    this.mode = "paint";
    this.pickColorArmed = false;
    this.fillGlobal = false;
    this.fillUvClip = false;
    this.selectShape = false;
    this.uvAccess = "edit";
  }

  #onModeClick(
    mode: Mode,
    event: MouseEvent
  ): void {
    const customEvent = new CustomEvent<Mode>("mode-change", {
      bubbles: true,
      composed: true,
      detail: mode
    });

    this.dispatchEvent(customEvent);
    this.#closeFlyout();
    (event.currentTarget as HTMLElement).blur();
  }

  #onPickColorClick(): void {
    const customEvent = new CustomEvent("pick-color-toggle", {
      bubbles: true,
      composed: true
    });

    this.dispatchEvent(customEvent);
    this.#closeFlyout();
  }

  #onVariantClick(
    mode: Mode,
    value: boolean
  ): void {
    const customEvent = new CustomEvent<ModeVariantDetail>("mode-variant-change", {
      bubbles: true,
      composed: true,
      detail: { mode, value }
    });

    this.dispatchEvent(customEvent);
    this.#closeFlyout();
  }

  #onFillUvClipClick(): void {
    const customEvent = new CustomEvent<boolean>("fill-uv-clip-change", {
      bubbles: true,
      composed: true,
      detail: !this.fillUvClip
    });

    this.dispatchEvent(customEvent);
    this.#closeFlyout();
  }

  #onItemEnter(
    mode: Mode
  ): void {
    this.#hoveredMode = mode;
    this.requestUpdate();
  }

  #onItemLeave(): void {
    this.#hoveredMode = null;
    this.requestUpdate();
  }

  #closeFlyout(): void {
    this.#hoveredMode = null;
    this.requestUpdate();
  }

  #displayIcon(
    mode: Mode,
    defaultIcon: IconName
  ): IconName {
    switch (mode) {
      case "paint":
        return this.pickColorArmed ? "eyedropper" : defaultIcon;
      case "fill":
        return this.fillGlobal ? "fillGlobal" : defaultIcon;
      case "select":
        return this.selectShape ? "wand" : defaultIcon;
      default:
        return defaultIcon;
    }
  }

  #flyoutButtons(
    mode: Mode
  ): FlyoutButton[] {
    switch (mode) {
      case "paint":
        return this.pickColorArmed ? [
          {
            icon: "paint",
            label: "Paint",
            onClick: () => this.#onPickColorClick()
          }
        ] : [
          {
            icon: "eyedropper",
            label: "Pick color",
            onClick: () => this.#onPickColorClick()
          }
        ];
      case "fill": {
        const buttons: FlyoutButton[] = [
          this.fillGlobal ?
            {
              icon: "fill",
              label: "Neighbor",
              onClick: () => this.#onVariantClick("fill", false)
            } :
            {
              icon: "fillGlobal",
              label: "Global",
              onClick: () => this.#onVariantClick("fill", true)
            }
        ];
        if (this.uvAccess !== "none") {
          buttons.push({
            icon: "uv",
            label: "Clip to UV",
            pressed: this.fillUvClip,
            onClick: () => this.#onFillUvClipClick()
          });
        }

        return buttons;
      }
      case "select":
        return this.selectShape ? [
          {
            icon: "select",
            label: "Rectangle",
            onClick: () => this.#onVariantClick("select", false)
          }
        ] : [
          {
            icon: "wand",
            label: "Shape",
            onClick: () => this.#onVariantClick("select", true)
          }
        ];
      default:
        return [];
    }
  }

  #modeItems(): ModeItem[] {
    return this.uvAccess === "edit" ?
      kModeItems :
      kModeItems.filter((item) => item.mode !== "uv");
  }

  #renderFlyout(
    buttons: FlyoutButton[]
  ) {
    if (buttons.length === 0) {
      return nothing;
    }

    return html`
      <div class="rail-flyout" part="rail-flyout">
        ${buttons.map(({ icon, label, pressed, onClick }) => html`
          <button
            class=${classMap({ "rail-btn": true, active: pressed === true })}
            part="rail-flyout-button"
            title=${label}
            aria-label=${label}
            aria-pressed=${pressed ?? nothing}
            @click=${(event: MouseEvent) => {
              onClick();
              (event.currentTarget as HTMLElement).blur();
            }}
          >
            ${renderIcon(icon)}
          </button>
        `)}
      </div>
    `;
  }

  override render() {
    return html`
      <jolly-rail role="group" aria-label="Drawing mode">
        ${this.#modeItems().map(({ mode, icon, label }) => {
          const flyoutButtons = this.#flyoutButtons(mode);

          return html`
            <div
              class=${classMap({ "rail-item": true, open: this.#hoveredMode === mode })}
              @mouseenter=${() => this.#onItemEnter(mode)}
              @mouseleave=${() => this.#onItemLeave()}
            >
              <button
                class=${classMap({
                  "rail-btn": true,
                  "has-flyout": flyoutButtons.length > 0,
                  active: this.mode === mode
                })}
                part="mode-button"
                aria-label=${label}
                aria-pressed=${this.mode === mode}
                @click=${(event: MouseEvent) => this.#onModeClick(mode, event)}
              >
                ${renderIcon(this.#displayIcon(mode, icon))}
                ${mode === "fill" && this.fillUvClip && this.uvAccess !== "none" ?
                  html`<span class="rail-badge" part="uv-clip-badge">UV</span>` :
                  nothing}
                ${flyoutButtons.length === 0 ? html`<span class="tooltip">${label}</span>` : nothing}
              </button>
              ${this.#renderFlyout(flyoutButtons)}
            </div>
          `;
        })}
      </jolly-rail>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mode-rail": ModeRail;
  }
}
