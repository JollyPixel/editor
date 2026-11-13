// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/separator";
import {
  SCENE_KIND,
  type GameSection
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsEditEvent } from "../SettingsEditEvent.ts";

// CONSTANTS
const kNoScene = "";

@customElement("studio-project-game")
export class ProjectGame extends LitElement {
  static override styles = [settingsStyles];

  @property({ attribute: false })
  declare value: GameSection | null;

  @property({ attribute: false })
  declare catalog: CatalogClient | null;

  @property({ type: Boolean })
  declare disabled: boolean;

  constructor() {
    super();
    this.value = null;
    this.catalog = null;
    this.disabled = false;
  }

  override render(): TemplateResult | typeof nothing {
    const { value } = this;
    if (value === null) {
      return nothing;
    }

    return html`
      <section aria-label="Game">
        <jolly-separator label="Game"></jolly-separator>
        <jolly-select
          data-field="default-scene"
          label="Default scene"
          description="The scene Play (F5) starts the game from"
          description-display="tooltip"
          ?disabled=${this.disabled}
          .options=${this.#sceneOptions()}
          .value=${value.start ?? kNoScene}
          @jolly-change=${(event: CustomEvent<{ value: string; }>) => {
            const start = event.detail.value;
            this.dispatchEvent(new SettingsEditEvent("game", {
              start: start === kNoScene ? null : start
            }));
          }}
        ></jolly-select>
      </section>
    `;
  }

  #sceneOptions(): { value: string; label: string; }[] {
    const scenes = Array.from(this.catalog?.records() ?? [])
      .filter((record) => record.kind === SCENE_KIND)
      .map((record) => {
        return {
          value: record.id,
          label: record.path
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));

    return [
      {
        value: kNoScene,
        label: "None"
      },
      ...scenes
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-game": ProjectGame;
  }
}
