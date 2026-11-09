// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import {
  forwardPlayShortcut,
  type PlayScope
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  PLAY_WINDOW,
  parsePlayError
} from "./protocol.ts";
import {
  GAME_CHANGE,
  type StudioProjectSettings
} from "../project/StudioProjectSettings.ts";
import type { StudioCatalog } from "../shell/StudioSession.ts";
import { PLAY_PAGE_DIR } from "../../shared/EditorDescriptor.ts";
import { SCENE_KIND } from "../../shared/GameManifest.ts";

// CONSTANTS
export const PLAY_CHANGE = "play-change";

export type PlayProject = Pick<
  StudioProjectSettings,
  "game" | "addEventListener"
>;

export interface StudioPlayOptions {
  catalog: Pick<StudioCatalog, "record">;
  project: PlayProject;
  /**
   * The asset of the active tab.
   */
  activeAsset: () => string | null;
  failed: (message: string) => void;
  /**
   * @default document.baseURI
   */
  baseUrl?: string;
  /**
   * @default window.open
   */
  open?: (url: URL, target: string) => Window | null;
}

export class StudioPlay extends EventTarget {
  #options: StudioPlayOptions;
  #window: Window | null = null;
  #listening = new AbortController();
  #stopShortcut: () => void;

  constructor(
    options: StudioPlayOptions
  ) {
    super();
    this.#options = options;
    const { signal } = this.#listening;
    options.project.addEventListener(GAME_CHANGE, this.changed, { signal });
    this.#stopShortcut = forwardPlayShortcut((scope) => this.play(scope));
    window.addEventListener("message", (event) => {
      if (!this.#fromGame(event)) {
        return;
      }

      const error = parsePlayError(event.data);
      if (error !== undefined) {
        this.#options.failed(error.message);
      }
    }, { signal });
  }

  get defaultScene(): AssetRecordData | null {
    return this.#scene(this.#options.project.game.start);
  }

  get currentScene(): AssetRecordData | null {
    return this.#scene(this.#options.activeAsset());
  }

  play(
    scope: PlayScope
  ): boolean {
    const scene = scope === "game" ?
      this.defaultScene ?? this.currentScene :
      this.currentScene;
    if (scene === null) {
      return false;
    }

    const url = new URL(
      `${PLAY_PAGE_DIR}/?start=${encodeURIComponent(scene.id)}`,
      this.#options.baseUrl ?? document.baseURI
    );
    const open = this.#options.open ?? ((target, name) => window.open(target, name));
    this.#window = open(url, PLAY_WINDOW);
    this.#window?.focus();

    return true;
  }

  readonly changed = (): void => {
    this.dispatchEvent(new Event(PLAY_CHANGE));
  };

  dispose(): void {
    this.#stopShortcut();
    this.#listening.abort();
  }

  #fromGame(
    event: MessageEvent
  ): boolean {
    const { source } = event;
    if (source === null) {
      return false;
    }
    if (source === this.#window) {
      return true;
    }

    return event.origin === location.origin &&
      "name" in source &&
      source.name === PLAY_WINDOW;
  }

  #scene(
    assetId: string | null
  ): AssetRecordData | null {
    if (assetId === null) {
      return null;
    }

    const record = this.#options.catalog.record(assetId);

    return record?.kind === SCENE_KIND ? record : null;
  }
}
