// Import Third-party Dependencies
import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

// Import Internal Dependencies
import type { Mode } from "../PixelArtCanvas.ts";
import { renderIcon, type IconName } from "./icons.ts";
import { iconStyles } from "./icon.styles.ts";
import { railButtonStyles } from "./rail-button.styles.ts";

// CONSTANTS
const kModeItems: { mode: Mode; icon: IconName; label: string; }[] = [
  { mode: "move", icon: "move", label: "Move" },
  { mode: "paint", icon: "paint", label: "Paint" },
  { mode: "fill", icon: "fill", label: "Fill" },
  { mode: "select", icon: "select", label: "Select" },
  { mode: "uv", icon: "uv", label: "UV" }
];

/**
 * Drawing-mode button group plus the paint-mode eyedropper toggle. Fully
 * controlled by `mode`/`pickColorArmed` props — reports intent via
 * `mode-change`/`pick-color-toggle` events rather than mutating any canvas
 * state itself.
 *
 * @fires {CustomEvent<Mode>} mode-change - Requests switching to the given mode.
 * @fires {CustomEvent<void>} pick-color-toggle - Requests toggling the eyedropper.
 */
@customElement("mode-rail")
export class ModeRail extends LitElement {
  static override styles = [iconStyles, railButtonStyles];

  @property({ type: String }) declare mode: Mode;
  @property({ type: Boolean }) declare pickColorArmed: boolean;

  constructor() {
    super();
    this.mode = "paint";
    this.pickColorArmed = false;
  }

  #onModeClick(
    mode: Mode
  ): void {
    this.dispatchEvent(new CustomEvent<Mode>("mode-change", {
      bubbles: true,
      composed: true,
      detail: mode
    }));
  }

  #onPickColorClick(): void {
    this.dispatchEvent(new CustomEvent("pick-color-toggle", {
      bubbles: true,
      composed: true
    }));
  }

  override render() {
    return html`
      <div class="rail-section" role="group" aria-label="Drawing mode">
        ${kModeItems.map(({ mode, icon, label }) => html`
          <button
            class="rail-btn ${this.mode === mode ? "active" : ""}"
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
              class="rail-btn ${this.pickColorArmed ? "active" : ""}"
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
