// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  SubscriptionController,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button-group";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/fields";

// Import Internal Dependencies
import {
  isLit,
  type KeyLightPreset,
  type LightingMode,
  type ViewSettings,
  type ViewSettingsStore
} from "../../state/index.ts";
import { LIGHTING_OPTIONS } from "./lightingOptions.ts";

// CONSTANTS
const kLightingHelp = "Flat shows plain colours, Studio a bright room, Day warm sunlight " +
  "under a blue sky, Night a dark scene where glow stands out. " +
  "Only you see these settings; the model doesn't change.";
const kLightingOptions: JollyOption<LightingMode>[] = LIGHTING_OPTIONS.map(
  ({ value, label }) => {
    return {
      value,
      label
    };
  }
);
const kKeyLightOptions: JollyOption<KeyLightPreset>[] = [
  {
    value: "front-left",
    label: "Front left",
    icon: "key-light-front-left"
  },
  {
    value: "front-right",
    label: "Front right",
    icon: "key-light-front-right"
  },
  {
    value: "top",
    label: "Top",
    icon: "key-light-top"
  }
];

export interface ViewEditing {
  view: ViewSettingsStore;
}

export class ViewPanel extends LitElement {
  static override styles = css`
    :host {
      display: block;
      flex: 0 0 auto;
    }

    jolly-folder::part(header) {
      font-size: calc(var(--jolly-font-size, 11px) + 2px);
    }

    jolly-fields {
      padding-block: var(--jolly-space-1, 4px);
    }

    .toggles {
      --jolly-label-max-width: 70%;

      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      row-gap: var(--jolly-row-gap, 4px);
    }
  `;

  #editing = new SubscriptionController<ViewEditing>(this, ({ view }) => [
    view.subscribe("change", () => this.requestUpdate())
  ]);

  attach(
    editing: ViewEditing
  ): void {
    this.#editing.attach(editing);
  }

  override render(): TemplateResult | typeof nothing {
    const settings = this.#editing.current?.view.settings;
    if (settings === undefined) {
      return nothing;
    }

    const lit = isLit(settings);

    return html`
      <jolly-folder
        flush
        key="view"
        label="View"
        storage-key="voxel-model:folder:view"
        .open=${false}
      >
        <jolly-fields>
          <jolly-button-group
            label="Lighting"
            description=${kLightingHelp}
            description-display="tooltip"
            .options=${kLightingOptions}
            .value=${settings.lighting}
            @jolly-change=${this.#bind("lighting")}
          ></jolly-button-group>
          <jolly-button-group
            label="Key light"
            description="Direction of the main light"
            description-display="tooltip"
            .options=${kKeyLightOptions}
            .value=${settings.keyLight}
            ?disabled=${!lit}
            @jolly-change=${this.#bind("keyLight")}
          ></jolly-button-group>
          <div class="toggles">
            <jolly-checkbox
              align="end"
              label="Shadows"
              description="The key light casts shadows across the model"
              description-display="tooltip"
              .value=${settings.shadows}
              ?disabled=${!lit}
              @jolly-change=${this.#bind("shadows")}
            ></jolly-checkbox>
            <jolly-checkbox
              align="end"
              label="Glow"
              description="Glowing materials bloom on screen"
              description-display="tooltip"
              .value=${settings.glow}
              @jolly-change=${this.#bind("glow")}
            ></jolly-checkbox>
            <jolly-checkbox
              align="end"
              label="Reflections"
              description="Metal and glossy materials reflect a studio room"
              description-display="tooltip"
              .value=${settings.reflections}
              ?disabled=${!lit}
              @jolly-change=${this.#bind("reflections")}
            ></jolly-checkbox>
          </div>
        </jolly-fields>
      </jolly-folder>
    `;
  }

  #bind<TKey extends keyof ViewSettings>(
    key: TKey
  ): (event: CustomEvent<JollyChangeDetail<ViewSettings[TKey]>>) => void {
    return (event) => this.#editing.current?.view.update({ [key]: event.detail.value });
  }
}

customElements.define("jolly-model-editor-view", ViewPanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-view": ViewPanel;
  }
}
