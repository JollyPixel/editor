// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  OFFLINE_GAME_CHANGE,
  type OfflineGameSettings
} from "../../../project/OfflineGameSettings.ts";
import { ChangeController } from "../../ChangeController.ts";
import type { SettingsEditEvent } from "../SettingsEditEvent.ts";
import "./ProjectGame.ts";
import "./ProjectPhysics.ts";

@customElement("studio-offline-game")
export class OfflineGame extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }
  `;

  @property({ attribute: false })
  declare settings: OfflineGameSettings | null;

  @property({ attribute: false })
  declare catalog: CatalogClient | null;

  #settings = new ChangeController<OfflineGameSettings>(
    this,
    OFFLINE_GAME_CHANGE
  );

  constructor() {
    super();
    this.settings = null;
    this.catalog = null;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("settings") && this.settings !== null) {
      this.#settings.attach(this.settings);
    }
  }

  override render(): TemplateResult | typeof nothing {
    const settings = this.#settings.current;
    if (settings === null) {
      return nothing;
    }

    return html`
      <studio-project-game
        .value=${settings.game}
        .catalog=${this.catalog}
        @settings-edit=${this.#onEdit}
      ></studio-project-game>
      <studio-project-physics
        .value=${settings.physics}
        @settings-edit=${this.#onEdit}
      ></studio-project-physics>
    `;
  }

  readonly #onEdit = (
    event: SettingsEditEvent
  ): void => {
    const settings = this.#settings.current;
    if (event.edits("game")) {
      settings?.update({ game: event.value });
    }
    else if (event.edits("physics")) {
      settings?.update({ physics: event.value });
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-offline-game": OfflineGame;
  }
}
