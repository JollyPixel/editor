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
import { type GameSection, SCENE_KIND } from "@jolly-pixel/server";

// Import Internal Dependencies
import type { StudioProjectSettings } from "../../../project/StudioProjectSettings.ts";
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsDraftController } from "./SettingsDraftController.ts";

// CONSTANTS
const kNoScene = "";

class GameDraft {
  readonly start: string | null;

  constructor(
    start: string | null
  ) {
    this.start = start;
  }

  toJSON(): GameSection {
    return {
      start: this.start
    };
  }
}

@customElement("studio-project-game")
export class ProjectGame extends LitElement {
  static override styles = [settingsStyles];

  #draft = new SettingsDraftController(this, {
    saved: (data) => new GameDraft(data.game.start),
    save: (project, draft) => project.replaceGame(draft.toJSON())
  });

  @property({ attribute: false })
  declare catalog: CatalogClient | null;

  constructor() {
    super();
    this.catalog = null;
  }

  set project(
    project: StudioProjectSettings
  ) {
    this.#draft.attach(project);
  }

  override render(): TemplateResult | typeof nothing {
    const { project, draft } = this.#draft;
    if (project === null || draft === null) {
      return nothing;
    }

    return html`
      <section aria-label="Game">
        <jolly-separator label="Game"></jolly-separator>
        ${this.#draft.error()}
        <jolly-select
          data-field="default-scene"
          label="Default scene"
          description="The scene Play (F5) starts the game from"
          description-display="tooltip"
          ?disabled=${!project.canEdit}
          .options=${this.#sceneOptions()}
          .value=${draft.start ?? kNoScene}
          @jolly-change=${(event: CustomEvent<{ value: string; }>) => {
            const { value } = event.detail;
            this.#draft.edit(new GameDraft(value === kNoScene ? null : value));
          }}
        ></jolly-select>
      </section>
      ${project.canEdit ? this.#draft.actions("Game actions") : nothing}
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
