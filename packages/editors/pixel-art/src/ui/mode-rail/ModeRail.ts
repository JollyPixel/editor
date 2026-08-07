// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";

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

// CONSTANTS
const kModeItems: ModeItem[] = [
  { mode: "move", icon: "move", label: "Move" },
  { mode: "paint", icon: "paint", label: "Paint" },
  { mode: "fill", icon: "fill", label: "Fill" },
  { mode: "select", icon: "select", label: "Select" },
  { mode: "uv", icon: "uv", label: "UV" }
];

/**
 * Mode buttons plus paint eyedropper toggle.
 * Controlled by props; emits intent events only.
 *
 * @fires {CustomEvent<Mode>} mode-change
 * @fires {CustomEvent<void>} pick-color-toggle
 */
@customElement("mode-rail")
export class ModeRail extends LitElement {
  static override styles = [
    iconStyles,
    railButtonStyles
  ];

  @property({ type: String })
  declare mode: Mode;

  @property({ type: Boolean })
  declare pickColorArmed: boolean;

  constructor() {
    super();
    this.mode = "paint";
    this.pickColorArmed = false;
  }

  #onModeClick(
    mode: Mode
  ): void {
    const customEvent = new CustomEvent<Mode>("mode-change", {
      bubbles: true,
      composed: true,
      detail: mode
    });

    this.dispatchEvent(customEvent);
  }

  #onPickColorClick(): void {
    const customEvent = new CustomEvent("pick-color-toggle", {
      bubbles: true,
      composed: true
    });

    this.dispatchEvent(customEvent);
  }

  override render() {
    return html`
      <div class="rail-section" role="group" aria-label="Drawing mode">
        ${kModeItems.map(({ mode, icon, label }) => html`
          <button
            class=${classMap({ "rail-btn": true, active: this.mode === mode })}
            part="mode-button"
            aria-label=${label}
            aria-pressed=${this.mode === mode}
            @click=${() => this.#onModeClick(mode)}
          >
            ${renderIcon(icon)}
            <span class="tooltip">${label}</span>
          </button>
          ${mode === "paint" ? html`
            <button
              class=${classMap({ "rail-btn": true, active: this.pickColorArmed })}
              part="pick-color-button"
              aria-label="Pick color"
              aria-pressed=${this.pickColorArmed}
              @click=${() => this.#onPickColorClick()}
            >
              ${renderIcon("eyedropper")}
              <span class="tooltip">Pick color</span>
            </button>
          ` : nothing}
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mode-rail": ModeRail;
  }
}
