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

// Import Internal Dependencies
import {
  resolveBackground,
  isLit,
  type KeyLightPreset,
  type ViewSettings,
  type ViewSettingsStore
} from "../../state/index.ts";
import { LIGHTING_OPTIONS } from "./lightingOptions.ts";

// CONSTANTS
const kLightingHelp = "Flat shows plain colours, Studio a bright room, Day warm sunlight " +
  "under a blue sky, Night a dark scene where glow stands out. " +
  "Only you see these settings; the model doesn't change.";
const kBackgroundHelp = "The viewport colour behind the model. " +
  "It follows the lighting until you pick your own.";
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

export interface ViewWorkspace {
  view: ViewSettingsStore;
}

export class ViewPanel extends LitElement {
  static override styles = css`
    :host {
      display: block;
      flex: 0 0 auto;
      border-top: 1px solid var(--jolly-border, rgb(128 128 128 / 30%));
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

    .background {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
    }

    .background jolly-color {
      flex: 1 1 0;
      min-width: 0;
    }

    .toggles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--jolly-row-gap, 4px) var(--jolly-space-2, 8px);
    }
  `;

  #workspace = new SubscriptionController<ViewWorkspace>(this, ({ view }) => [
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

    const lit = isLit(settings);

    return html`
      <jolly-folder key="view" label="View" .open=${false}>
        <div class="fields">
          <jolly-button-group
            label="Lighting"
            description=${kLightingHelp}
            description-display="tooltip"
            icon-only
            .options=${LIGHTING_OPTIONS}
            .value=${settings.lighting}
            @jolly-change=${this.#bind("lighting")}
          ></jolly-button-group>
          <jolly-button-group
            label="Key light"
            description="Direction of the main light"
            description-display="tooltip"
            icon-only
            .options=${kKeyLightOptions}
            .value=${settings.keyLight}
            ?disabled=${!lit}
            @jolly-change=${this.#bind("keyLight")}
          ></jolly-button-group>
          <div class="background">
            <jolly-color
              label="Background"
              description=${kBackgroundHelp}
              description-display="tooltip"
              .value=${resolveBackground(settings)}
              @jolly-input=${this.#bind("background")}
              @jolly-change=${this.#bind("background")}
            ></jolly-color>
            ${settings.background === null ? nothing : html`
              <jolly-button
                icon="revert"
                icon-only
                label="Use the lighting's background"
                title="Use the lighting's background"
                @click=${this.#resetBackground}
              ></jolly-button>
            `}
          </div>
          <div class="toggles">
            <jolly-toggle
              label="Reflections"
              description="Metal and glossy materials reflect a studio room"
              description-display="tooltip"
              .value=${settings.reflections}
              ?disabled=${!lit}
              @jolly-change=${this.#bind("reflections")}
            ></jolly-toggle>
            <jolly-toggle
              label="Shadows"
              description="The key light casts shadows across the model"
              description-display="tooltip"
              .value=${settings.shadows}
              ?disabled=${!lit}
              @jolly-change=${this.#bind("shadows")}
            ></jolly-toggle>
            <jolly-toggle
              label="Glow"
              description="Glowing materials bloom on screen"
              description-display="tooltip"
              .value=${settings.glow}
              @jolly-change=${this.#bind("glow")}
            ></jolly-toggle>
          </div>
        </div>
      </jolly-folder>
    `;
  }

  readonly #resetBackground = (): void => {
    this.#workspace.current?.view.update({ background: null });
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
