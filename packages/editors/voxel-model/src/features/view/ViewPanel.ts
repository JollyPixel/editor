// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import type {
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import "./viewIcons.ts";
import {
  ENVIRONMENT_INTENSITY_RANGE,
  EXPOSURE_RANGE,
  GLOW_STRENGTH_RANGE,
  type KeyLightPreset,
  type ShadingMode,
  type ViewSettings,
  type ViewSettingsStore
} from "../../state/index.ts";
import { WorkspaceController } from "../../shared/WorkspaceController.ts";

// CONSTANTS
const kShadingOptions: JollyOption<ShadingMode>[] = [
  {
    value: "lit",
    label: "Lit",
    icon: "view-lit"
  },
  {
    value: "flat",
    label: "Flat",
    icon: "view-flat"
  }
];
const kKeyLightOptions: JollyOption<KeyLightPreset>[] = [
  {
    value: "front-left",
    label: "Front left"
  },
  {
    value: "front-right",
    label: "Front right"
  },
  {
    value: "top",
    label: "Top"
  }
];

type NumberSetting = {
  [TKey in keyof ViewSettings]: ViewSettings[TKey] extends number ? TKey : never;
}[keyof ViewSettings];

export interface ViewWorkspace {
  view: ViewSettingsStore;
}

export class ViewPanel extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }

    jolly-folder::part(header) {
      font-size: calc(var(--jolly-font-size, 11px) + 2px);
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding: var(--jolly-space-1, 4px);
    }
  `;

  #workspace = new WorkspaceController<ViewWorkspace>(this, ({ view }) => [
    view.subscribe("change", () => this.requestUpdate())
  ]);

  attach(
    workspace: ViewWorkspace
  ): void {
    this.#workspace.attach(workspace);
  }

  override render(): TemplateResult | typeof nothing {
    const settings = this.#workspace.current?.view.settings;
    if (settings === undefined) {
      return nothing;
    }

    const lit = settings.shading === "lit";

    return html`
      <jolly-folder key="view" label="View" .open=${false}>
        <jolly-button
          slot="actions"
          icon=${lit ? "view-lit" : "view-flat"}
          icon-only
          label=${lit ? "Shading: Lit" : "Shading: Flat"}
          title=${lit ? "Lit: switch to Flat" : "Flat: switch to Lit"}
          @click=${this.#toggleShading}
        ></jolly-button>
        <div class="fields">
          <jolly-button-group
            label="Shading"
            .options=${kShadingOptions}
            .value=${settings.shading}
            @jolly-change=${this.#bind("shading")}
          ></jolly-button-group>
          <jolly-select
            label="Key light"
            .options=${kKeyLightOptions}
            .value=${settings.keyLight}
            ?disabled=${!lit}
            @jolly-change=${this.#bind("keyLight")}
          ></jolly-select>
          ${this.#renderSlider(
            settings,
            "Exposure",
            "exposure",
            EXPOSURE_RANGE,
            !lit
          )}
          <jolly-checkbox
            label="Environment"
            .value=${settings.environment}
            ?disabled=${!lit}
            @jolly-change=${this.#bind("environment")}
          ></jolly-checkbox>
          ${this.#renderSlider(
            settings,
            "Reflections",
            "environmentIntensity",
            ENVIRONMENT_INTENSITY_RANGE,
            !lit || !settings.environment
          )}
          <jolly-checkbox
            label="Glow"
            .value=${settings.glow}
            @jolly-change=${this.#bind("glow")}
          ></jolly-checkbox>
          ${this.#renderSlider(
            settings,
            "Glow strength",
            "glowStrength",
            GLOW_STRENGTH_RANGE,
            !settings.glow
          )}
        </div>
      </jolly-folder>
    `;
  }

  #renderSlider(
    settings: ViewSettings,
    label: string,
    key: NumberSetting,
    bounds: { min: number; max: number; },
    disabled: boolean
  ): TemplateResult {
    const onValue = this.#bind(key);

    return html`
      <jolly-slider
        label=${label}
        min=${bounds.min}
        max=${bounds.max}
        step="0.05"
        .value=${settings[key]}
        ?disabled=${disabled}
        @jolly-input=${onValue}
        @jolly-change=${onValue}
      ></jolly-slider>
    `;
  }

  readonly #toggleShading = (
    event: Event
  ): void => {
    event.stopPropagation();
    const view = this.#workspace.current?.view;
    view?.update({
      shading: view.settings.shading === "lit" ? "flat" : "lit"
    });
  };

  #bind<TKey extends keyof ViewSettings>(
    key: TKey
  ): (event: CustomEvent<JollyChangeDetail<ViewSettings[TKey]>>) => void {
    return (event) => this.#workspace.current?.view.update({ [key]: event.detail.value });
  }
}

customElements.define("jolly-model-editor-view", ViewPanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-view": ViewPanel;
  }
}
