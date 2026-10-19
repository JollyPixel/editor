// Import Third-party Dependencies
import {
  css,
  html,
  LitElement,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import {
  MAX_WALKABLE_SLOPE,
  TERRAIN_OVERLAYS,
  type TerrainOverlay
} from "@jolly-pixel/terrain.renderer";
import { FieldBinding } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ViewSettings } from "../model/ViewSettings.ts";
import "./viewIcons.ts";

// CONSTANTS
const kOverlayLabels: Readonly<Record<TerrainOverlay, string>> = {
  none: "No overlay",
  chunks: "Chunk grid",
  lod: "LoD levels",
  slope: "Slope"
};

@customElement("terrain-view-toolbar")
export class ViewToolbar extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
    }

    jolly-rail {
      gap: 0;
      height: auto;
      padding: 4px;
      border-radius: var(--jolly-radius-sm, 2px);
      background: var(--jolly-surface-raised);
      box-shadow: var(--jolly-shadow-floating);
    }

    .group {
      display: flex;
      align-items: center;
    }

    .divided::before {
      content: "";
      width: 1px;
      height: 22px;
      margin-inline: 6px;
      background: var(--jolly-divider);
    }

    jolly-tool-button {
      --jolly-tool-button-size: 30px;
      --jolly-tool-button-gap: 10px;
    }

    jolly-tool-button::part(notch) {
      display: none;
    }

    .value {
      min-width: 3ch;
      font-weight: 600;
      text-align: center;
    }
  `;

  @property({ attribute: false })
  declare settings: ViewSettings | null;

  #walkableSlope = new FieldBinding<number>(this, {
    read: () => this.settings?.options.walkableSlope ?? 0,
    write: (walkableSlope) => this.settings?.update({ walkableSlope })
  });

  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.settings = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  protected override willUpdate(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("settings")) {
      this.#unsubscribe?.();
      this.#unsubscribe = this.settings?.subscribe("change", () => this.requestUpdate()) ?? null;
    }
  }

  override render(): TemplateResult | typeof nothing {
    const settings = this.settings;
    if (settings === null) {
      return nothing;
    }

    const { overlay } = settings.options;

    return html`
      <jolly-rail orientation="horizontal" role="toolbar" aria-label="View">
        <div class="group" role="group" aria-label="Overlay">
          ${TERRAIN_OVERLAYS.map((option) => html`
            <jolly-tool-button
              data-overlay=${option}
              flyout-side="below"
              icon=${`overlay-${option}`}
              label=${kOverlayLabels[option]}
              ?active=${option === overlay}
              @click=${() => settings.update({ overlay: option })}
            ></jolly-tool-button>
          `)}
        </div>
        ${overlay === "slope" ? this.#renderWalkableSlope() : nothing}
      </jolly-rail>
    `;
  }

  #renderWalkableSlope(): TemplateResult {
    const degrees = Math.round(this.#walkableSlope.value);

    return html`
      <div class="group divided" role="group" aria-label="Slope">
        <jolly-tool-button
          data-tool="walkable-slope"
          flyout-side="below"
          label=${`Walkable up to ${degrees}°, red above`}
        >
          <span class="value">${degrees}°</span>
          <jolly-slider
            slot="flyout"
            orientation="vertical"
            min="0"
            max=${MAX_WALKABLE_SLOPE}
            step="1"
            .value=${this.#walkableSlope.value}
            @jolly-input=${this.#walkableSlope.input}
            @jolly-change=${this.#walkableSlope.commit}
          ></jolly-slider>
        </jolly-tool-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "terrain-view-toolbar": ViewToolbar;
  }
}
