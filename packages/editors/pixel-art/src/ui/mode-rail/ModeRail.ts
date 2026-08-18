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

interface ModeItem {
  mode: Mode;
  icon: IconName;
  label: string;
}

interface FlyoutButton {
  icon: IconName;
  label: string;
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
  { mode: "fill", icon: "fill", label: "Fill" },
  { mode: "select", icon: "select", label: "Select" },
  { mode: "uv", icon: "uv", label: "UV" }
];

/**
 * Mode buttons. Fill/select/paint hide a related alternate tool behind a
 * hover flyout (e.g. Fill -> Global, only shown while Neighbor is active)
 * instead of a permanent second button, keeping the rail's default
 * footprint small. Controlled by props; emits intent events only.
 *
 * @fires {CustomEvent<Mode>} mode-change
 * @fires {CustomEvent<void>} pick-color-toggle
 * @fires {CustomEvent<ModeVariantDetail>} mode-variant-change
 */
@customElement("mode-rail")
export class ModeRail extends LitElement {
  static override styles = [
    iconStyles,
    railButtonStyles,
    css`
      jolly-rail {
        background: transparent;
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
  declare selectShape: boolean;

  /**
   * Which rail item's flyout is open. JS-driven (not plain CSS :hover) so a
   * click can force it shut immediately instead of waiting for the mouse to
   * leave the area.
   */
  #hoveredMode: Mode | null = null;

  constructor() {
    super();
    this.mode = "paint";
    this.pickColorArmed = false;
    this.fillGlobal = false;
    this.selectShape = false;
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
    // Clicking focuses the button, which would keep the flyout open via
    // the :focus-within keyboard-accessibility fallback.
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

  /**
   * The rail button itself shows whichever variant is currently active
   * (e.g. the wand once Shape is picked) — the flyout only ever offers the
   * way back to the other one.
   */
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

  /**
   * Only the non-active alternative is offered — the mode already active
   * doesn't need its own button restating it.
   */
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
      case "fill":
        return this.fillGlobal ? [
          {
            icon: "fill",
            label: "Neighbor",
            onClick: () => this.#onVariantClick("fill", false)
          }
        ] : [
          {
            icon: "fillGlobal",
            label: "Global",
            onClick: () => this.#onVariantClick("fill", true)
          }
        ];
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

  #renderFlyout(
    buttons: FlyoutButton[]
  ) {
    if (buttons.length === 0) {
      return nothing;
    }

    return html`
      <div class="rail-flyout" part="rail-flyout">
        ${buttons.map(({ icon, label, onClick }) => html`
          <button
            class="rail-btn"
            part="rail-flyout-button"
            title=${label}
            aria-label=${label}
            @click=${(event: MouseEvent) => {
              onClick();
              // Clicking focuses the button, which would keep the flyout
              // open via the :focus-within keyboard-accessibility fallback.
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
        ${kModeItems.map(({ mode, icon, label }) => {
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
