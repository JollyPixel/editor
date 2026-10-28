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
import type { HistoryScopeState } from "@jolly-pixel/history";
import { HEIGHT_RANGE } from "@jolly-pixel/terrain.renderer";
import {
  FieldBinding,
  SubscriptionController
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/rail";
import "@jolly-pixel/ui/elements/slider";
import "@jolly-pixel/ui/elements/tool-button";

// Import Internal Dependencies
import {
  FALLOFF_CURVES,
  type FalloffCurve
} from "../model/falloff.ts";
import {
  BRUSH_SIZE,
  BRUSH_TOOLS,
  STRENGTH_OPTIONS,
  type BrushTool,
  type SculptOptions,
  type SculptSettings
} from "../model/SculptSettings.ts";
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../../shared/terrainHistory.ts";
import { viewportToolbarStyles } from "../../../shared/toolbar.styles.ts";
import "../../../shared/historyIcons.ts";
import "./sculptIcons.ts";

// CONSTANTS
const kToolLabels: Readonly<Record<BrushTool, string>> = {
  raise: "Raise and lower (right button lowers)",
  smooth: "Smooth",
  flatten: "Flatten",
  paint: "Paint the selected material (Ctrl+click picks one)"
};
const kFalloffLabels: Readonly<Record<FalloffCurve, string>> = {
  smooth: "Smooth",
  linear: "Linear",
  sphere: "Sphere",
  sharp: "Sharp",
  constant: "Constant"
};

@customElement("terrain-sculpt-toolbar")
export class SculptToolbar extends LitElement {
  static override styles = viewportToolbarStyles;

  @property({ attribute: false })
  declare settings: SculptSettings | null;

  @property({ attribute: false })
  declare history: TerrainHistory | null;

  #size = new FieldBinding<number>(this, {
    read: () => this.settings?.options.size ?? BRUSH_SIZE.min,
    write: (size) => this.settings?.update({ size })
  });

  #strength = new FieldBinding<number>(this, {
    read: () => {
      const options = this.settings?.options;

      return options === undefined ? 0 : Math.round(options[STRENGTH_OPTIONS[options.tool]] * 100);
    },
    write: (percent) => {
      const settings = this.settings;
      if (settings === null) {
        return;
      }

      const changes: Partial<SculptOptions> = {};
      changes[STRENGTH_OPTIONS[settings.options.tool]] = percent / 100;
      settings.update(changes);
    }
  });

  #flattenHeight = new FieldBinding<number>(this, {
    read: () => this.settings?.options.flattenHeight ?? 0,
    write: (flattenHeight) => this.settings?.update({ flattenHeight })
  });

  #settingsSubscription = new SubscriptionController<SculptSettings | null>(
    this,
    (settings) => (settings === null ?
      [] :
      [settings.subscribe("change", () => this.requestUpdate())])
  );

  #historySubscription = new SubscriptionController<TerrainHistory | null>(
    this,
    (history) => (history === null ?
      [] :
      [history.subscribe("change", () => this.requestUpdate())])
  );

  constructor() {
    super();
    this.settings = null;
    this.history = null;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("settings")) {
      this.#settingsSubscription.attach(this.settings);
    }
    if (changed.has("history")) {
      this.#historySubscription.attach(this.history);
    }
  }

  override render(): TemplateResult | typeof nothing {
    const settings = this.settings;
    if (settings === null) {
      return nothing;
    }

    const { tool, falloff } = settings.options;

    return html`
      <jolly-rail orientation="horizontal" floating role="toolbar" aria-label="Sculpt">
        ${this.#renderHistory()}
        <div class="group divided" role="group" aria-label="Brush">
          ${BRUSH_TOOLS.map((option) => html`
            <jolly-tool-button
              data-tool=${option}
              icon=${`sculpt-${option}`}
              label=${kToolLabels[option]}
              ?active=${option === tool}
              @click=${() => settings.update({ tool: option })}
            ></jolly-tool-button>
          `)}
        </div>
        <div class="group divided" role="group" aria-label="Brush settings">
          <jolly-tool-button
            data-tool="size"
            flyout-side="above"
            label=${`Size ${formatMetres(this.#size.value)} (Ctrl + wheel)`}
          >
            <span class="value">${Math.round(this.#size.value)}</span>
            <jolly-slider
              slot="flyout"
              orientation="vertical"
              min=${BRUSH_SIZE.min}
              max=${BRUSH_SIZE.max}
              step="0.5"
              .value=${this.#size.value}
              @jolly-input=${this.#size.input}
              @jolly-change=${this.#size.commit}
            ></jolly-slider>
          </jolly-tool-button>
          <jolly-tool-button
            data-tool="strength"
            flyout-side="above"
            label=${`Strength ${this.#strength.value}%`}
          >
            <span class="value">${this.#strength.value}</span>
            <jolly-slider
              slot="flyout"
              orientation="vertical"
              min="0"
              max="100"
              step="1"
              .value=${this.#strength.value}
              @jolly-input=${this.#strength.input}
              @jolly-change=${this.#strength.commit}
            ></jolly-slider>
          </jolly-tool-button>
          <jolly-tool-button
            data-tool="falloff"
            data-value=${falloff}
            flyout-side="above"
            icon=${`falloff-${falloff}`}
            label=${`Falloff: ${kFalloffLabels[falloff]}`}
          >
            ${FALLOFF_CURVES.filter((curve) => curve !== falloff).map((curve) => html`
              <jolly-tool-button
                slot="flyout"
                data-value=${curve}
                flyout-side="left"
                icon=${`falloff-${curve}`}
                label=${kFalloffLabels[curve]}
                @click=${() => settings.update({ falloff: curve })}
              ></jolly-tool-button>
            `)}
          </jolly-tool-button>
        </div>
        ${tool === "flatten" ? this.#renderFlattenTarget(settings) : nothing}
      </jolly-rail>
    `;
  }

  #renderFlattenTarget(
    settings: SculptSettings
  ): TemplateResult {
    const fixed = settings.options.flattenTarget === "fixed";

    return html`
      <div class="group divided" role="group" aria-label="Flatten target">
        <jolly-tool-button
          data-tool="flatten-target"
          icon="flatten-fixed"
          label=${fixed ?
            "Flatten to a fixed height (Ctrl+click picks it)" :
            "Flatten to the height under the press (Ctrl+click picks a fixed height)"}
          ?active=${fixed}
          @click=${() => settings.update({ flattenTarget: fixed ? "press" : "fixed" })}
        ></jolly-tool-button>
        ${fixed ? html`
          <jolly-tool-button
            data-tool="flatten-height"
            flyout-side="above"
            label=${`Fixed height ${formatMetres(this.#flattenHeight.value)}`}
          >
            <span class="value">${Math.round(this.#flattenHeight.value)}</span>
            <jolly-number
              slot="flyout"
              label="Height (m)"
              min=${HEIGHT_RANGE.min}
              max=${HEIGHT_RANGE.max}
              step="0.1"
              .value=${this.#flattenHeight.value}
              @jolly-input=${this.#flattenHeight.input}
              @jolly-change=${this.#flattenHeight.commit}
            ></jolly-number>
          </jolly-tool-button>
        ` : nothing}
      </div>
    `;
  }

  #renderHistory(): TemplateResult | typeof nothing {
    const history = this.history;
    if (history === null) {
      return nothing;
    }

    const state: HistoryScopeState = history.state(TERRAIN_HISTORY_SCOPE);

    return html`
      <div class="group" role="group" aria-label="History">
        <jolly-tool-button
          data-tool="undo"
          icon="undo"
          label="Undo (Ctrl+Z)"
          .count=${state.undoCount}
          ?disabled=${state.undoCount === 0}
          @click=${() => history.undo(TERRAIN_HISTORY_SCOPE)}
        ></jolly-tool-button>
        <jolly-tool-button
          data-tool="redo"
          icon="redo"
          label="Redo (Ctrl+Y)"
          .count=${state.redoCount}
          ?disabled=${state.redoCount === 0}
          @click=${() => history.redo(TERRAIN_HISTORY_SCOPE)}
        ></jolly-tool-button>
      </div>
    `;
  }
}

function formatMetres(
  value: number
): string {
  return `${Number(value.toFixed(1))} m`;
}

declare global {
  interface HTMLElementTagNameMap {
    "terrain-sculpt-toolbar": SculptToolbar;
  }
}
