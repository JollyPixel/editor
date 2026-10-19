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
import type { HistoryScopeState } from "@jolly-pixel/history";
import { HEIGHT_RANGE } from "@jolly-pixel/terrain.renderer";
import { FieldBinding } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  FALLOFF_CURVES,
  type FalloffCurve
} from "../model/falloff.ts";
import {
  BRUSH_SIZE,
  type SculptSettings
} from "../model/SculptSettings.ts";
import {
  SCULPT_TOOLS,
  type SculptTool
} from "../model/sculptStamp.ts";
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../../shared/terrainHistory.ts";
import "../../../shared/historyIcons.ts";
import "./sculptIcons.ts";

// CONSTANTS
const kToolLabels: Readonly<Record<SculptTool, string>> = {
  raise: "Raise and lower (right button lowers)",
  smooth: "Smooth",
  flatten: "Flatten"
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

    .step-count {
      position: absolute;
      inset-block-end: 1px;
      inset-inline-end: 2px;
      font-size: 9px;
      font-weight: 600;
      pointer-events: none;
    }

    .value {
      min-width: 3ch;
      font-weight: 600;
      text-align: center;
    }
  `;

  @property({ attribute: false })
  declare settings: SculptSettings | null;

  @property({ attribute: false })
  declare history: TerrainHistory | null;

  #size = new FieldBinding<number>(this, {
    read: () => this.settings?.options.size ?? BRUSH_SIZE.min,
    write: (size) => this.settings?.update({ size })
  });

  #strength = new FieldBinding<number>(this, {
    read: () => Math.round((this.settings?.options.strength ?? 0) * 100),
    write: (percent) => this.settings?.update({ strength: percent / 100 })
  });

  #flattenHeight = new FieldBinding<number>(this, {
    read: () => this.settings?.options.flattenHeight ?? 0,
    write: (flattenHeight) => this.settings?.update({ flattenHeight })
  });

  #unsubscribe: (() => void) | null = null;
  #unsubscribeHistory: (() => void) | null = null;

  constructor() {
    super();
    this.settings = null;
    this.history = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#unsubscribeHistory?.();
    this.#unsubscribeHistory = null;
  }

  protected override willUpdate(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("settings")) {
      this.#unsubscribe?.();
      this.#unsubscribe = this.settings?.subscribe("change", () => this.requestUpdate()) ?? null;
    }
    if (changed.has("history")) {
      this.#unsubscribeHistory?.();
      this.#unsubscribeHistory = this.history?.subscribe("change", () => this.requestUpdate()) ?? null;
    }
  }

  override render(): TemplateResult | typeof nothing {
    const settings = this.settings;
    if (settings === null) {
      return nothing;
    }

    const { tool, falloff } = settings.options;

    return html`
      <jolly-rail orientation="horizontal" role="toolbar" aria-label="Sculpt">
        ${this.#renderHistory()}
        <div class="group divided" role="group" aria-label="Brush">
          ${SCULPT_TOOLS.map((option) => html`
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
          ?disabled=${state.undoCount === 0}
          @click=${() => history.undo(TERRAIN_HISTORY_SCOPE)}
        >${renderStepCount(state.undoCount)}</jolly-tool-button>
        <jolly-tool-button
          data-tool="redo"
          icon="redo"
          label="Redo (Ctrl+Y)"
          ?disabled=${state.redoCount === 0}
          @click=${() => history.redo(TERRAIN_HISTORY_SCOPE)}
        >${renderStepCount(state.redoCount)}</jolly-tool-button>
      </div>
    `;
  }
}

function renderStepCount(
  count: number
): TemplateResult | typeof nothing {
  return count === 0 ? nothing : html`<span class="step-count" aria-hidden="true">${count}</span>`;
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
