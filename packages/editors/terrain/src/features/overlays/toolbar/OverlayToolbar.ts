// Import Third-party Dependencies
import {
  html,
  LitElement,
  nothing,
  type PropertyValues,
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
import {
  FieldBinding,
  SubscriptionController
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/rail";
import "@jolly-pixel/ui/elements/slider";
import "@jolly-pixel/ui/elements/tool-button";

// Import Internal Dependencies
import type { OverlaySettings } from "../model/OverlaySettings.ts";
import { viewportToolbarStyles } from "../../../shared/toolbar.styles.ts";
import "./overlayIcons.ts";

// CONSTANTS
const kOverlayLabels: Readonly<Record<TerrainOverlay, string>> = {
  none: "No overlay",
  chunks: "Chunk grid",
  lod: "LoD levels",
  slope: "Slope",
  splat: "Painted materials"
};

@customElement("terrain-overlay-toolbar")
export class OverlayToolbar extends LitElement {
  static override styles = viewportToolbarStyles;

  @property({ attribute: false })
  declare settings: OverlaySettings | null;

  #walkableSlope = new FieldBinding<number>(this, {
    read: () => this.settings?.options.walkableSlope ?? 0,
    write: (walkableSlope) => this.settings?.update({ walkableSlope })
  });

  #settingsSubscription = new SubscriptionController<OverlaySettings | null>(
    this,
    (settings) => (settings === null ?
      [] :
      [settings.subscribe("change", () => this.requestUpdate())])
  );

  constructor() {
    super();
    this.settings = null;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("settings")) {
      this.#settingsSubscription.attach(this.settings);
    }
  }

  override render(): TemplateResult | typeof nothing {
    const settings = this.settings;
    if (settings === null) {
      return nothing;
    }

    const { overlay } = settings.options;

    return html`
      <jolly-rail orientation="horizontal" floating role="toolbar" aria-label="Overlays">
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
    "terrain-overlay-toolbar": OverlayToolbar;
  }
}
