// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";
import {
  AssetPath,
  type AssetRecordData
} from "@jolly-pixel/asset";
import type { ContextMenuEntry } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/icon";

// Import Internal Dependencies
import {
  PLAY_CHANGE,
  type StudioPlay
} from "../../play/StudioPlay.ts";
import { GENERAL_SECTION } from "../settings/SettingsSections.ts";
import { SettingsOpenEvent } from "../settings/SettingsOpenEvent.ts";

@customElement("studio-play-button")
export class PlayButton extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 1px;
    }
  `;

  @property({ attribute: false })
  declare play: StudioPlay | null;

  @query("jolly-context-menu")
  declare _menu: HTMLElementTagNameMap["jolly-context-menu"] | null;

  #listening: AbortController | null = null;

  constructor() {
    super();
    this.play = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#listening?.abort();
    this.#listening = null;
  }

  protected override willUpdate(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("play") || this.#listening === null) {
      this.#listening?.abort();
      this.#listening = new AbortController();
      this.play?.addEventListener(
        PLAY_CHANGE,
        () => this.requestUpdate(),
        { signal: this.#listening.signal }
      );
    }
  }

  override render(): TemplateResult | typeof nothing {
    const play = this.play;
    const target = play?.defaultScene ?? play?.currentScene ?? null;
    if (play === null || target === null) {
      return nothing;
    }

    return html`
      <jolly-button
        data-action="play"
        title=${`Play ${sceneName(target)} (F5)`}
        @click=${() => play.play("game")}
      >
        <jolly-icon name="play"></jolly-icon>
        <span>Play</span>
      </jolly-button>
      <jolly-button
        data-action="play-menu"
        aria-haspopup="menu"
        title="Play options"
        @click=${this.#openMenu}
      >
        <jolly-icon name="chevron"></jolly-icon>
      </jolly-button>
      <jolly-context-menu
        label="Play"
        .items=${playMenu(play.defaultScene, play.currentScene)}
        @jolly-context-action=${this.#onAction}
      ></jolly-context-menu>
    `;
  }

  readonly #openMenu = (
    event: MouseEvent
  ): void => {
    const button = event.currentTarget;
    if (this._menu === null || !(button instanceof HTMLElement)) {
      return;
    }

    const { right, bottom } = button.getBoundingClientRect();
    this._menu.openAt(right, bottom);
  };

  readonly #onAction = (
    event: HTMLElementEventMap["jolly-context-action"]
  ): void => {
    switch (event.detail.id) {
      case "game":
      case "scene":
        this.play?.play(event.detail.id);
        break;
      case "settings":
        this.dispatchEvent(new SettingsOpenEvent(GENERAL_SECTION));
        break;
    }
  };
}

export function playMenu(
  defaultScene: AssetRecordData | null,
  currentScene: AssetRecordData | null
): ContextMenuEntry[] {
  return [
    {
      id: "game",
      label: defaultScene === null ?
        "Play game (F5)" :
        `Play ${sceneName(defaultScene)} (F5)`,
      icon: "play",
      disabled: defaultScene === null
    },
    {
      id: "scene",
      label: "Play current scene (Ctrl+F5)",
      icon: "play",
      disabled: currentScene === null
    },
    "separator",
    {
      id: "settings",
      label: "Set default scene…",
      icon: "settings"
    }
  ];
}

function sceneName(
  record: AssetRecordData
): string {
  return new AssetPath(record.path).name;
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-play-button": PlayButton;
  }
}
