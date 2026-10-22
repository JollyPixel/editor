// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { ShellCommand } from "@jolly-pixel/editor.host";
import {
  InvalidPreferencesError,
  type PreferenceOverrides,
  type Preferences
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import type { AssetKindSet } from "../catalog/AssetKindSet.ts";
import { AssetPath } from "../catalog/AssetPath.ts";
import type { EditorRegistry } from "../editors/EditorRegistry.ts";
import type { PreferenceScopes } from "../../shared/PreferenceScopes.ts";
import { BrowserState } from "../browser/BrowserState.ts";
import {
  EditorFrames,
  type EditorFramesOptions
} from "../tabs/EditorFrames.ts";
import {
  EditorTabs,
  type EditorTabOpenOptions,
  type EditorTabsOptions,
  type EditorTabTitle
} from "../tabs/EditorTabs.ts";
import { SavedTabs } from "../tabs/SavedTabs.ts";

export interface StudioCatalog {
  record(
    assetId: string
  ): AssetRecordData | undefined;
  on(
    event: "change",
    listener: () => void
  ): unknown;
  off(
    event: "change",
    listener: () => void
  ): unknown;
}

export interface StudioSessionRenewal {
  renew(): Promise<void>;
  onRenewed(
    listener: () => void
  ): () => void;
}

export interface StudioSessionPreferences {
  values: Preferences;
  scopes: PreferenceScopes;
}

export interface StudioSessionConsole {
  toggle(): void;
}

export interface StudioSessionOptions {
  catalog: StudioCatalog;
  editors: EditorRegistry;
  tabs: Omit<EditorTabsOptions, "frames" | "onChange">;
  frames: Omit<EditorFramesOptions, "onShellCommand" | "preferences">;
  /**
   * What frames read with their launch and change with `update-preferences`.
   */
  preferences: StudioSessionPreferences;
  onTabsChange?: () => void;
  console?: StudioSessionConsole;
  renewal?: StudioSessionRenewal;
  /**
   * @default new BrowserState()
   */
  browserState?: BrowserState;
}

export class StudioSession {
  readonly kinds: AssetKindSet;
  readonly tabs: EditorTabs;

  #catalog: StudioCatalog;
  #frames: EditorFrames;
  #editors: EditorRegistry;
  #browserState: BrowserState;
  #onTabsChange: (() => void) | undefined;
  #console: StudioSessionConsole | undefined;
  #renewal: StudioSessionRenewal | undefined;
  #preferences: StudioSessionPreferences;
  #stopRenewal: (() => void) | undefined;
  #restoring = false;
  #listening = new AbortController();

  constructor(
    options: StudioSessionOptions
  ) {
    this.#catalog = options.catalog;
    this.#editors = options.editors;
    this.#browserState = options.browserState ?? new BrowserState();
    this.#onTabsChange = options.onTabsChange;
    this.#console = options.console;
    this.#renewal = options.renewal;
    this.#preferences = options.preferences;
    this.kinds = options.editors.kindSet();
    this.#frames = new EditorFrames({
      ...options.frames,
      preferences: options.preferences.values,
      onShellCommand: this.#onShellCommand
    });
    this.tabs = new EditorTabs({
      ...options.tabs,
      frames: this.#frames,
      onChange: this.#onChange
    });
    this.#catalog.on("change", this.#syncTabs);
    this.#stopRenewal = this.#renewal?.onRenewed(
      () => this.#frames.notifySessionRenewed()
    );
    window.addEventListener("beforeunload", this.#onBeforeUnload, {
      signal: this.#listening.signal
    });
  }

  toggleConsole(): void {
    this.#console?.toggle();
  }

  async openAsset(
    assetId: string,
    options: EditorTabOpenOptions = {}
  ): Promise<boolean> {
    const record = this.#catalog.record(assetId);
    if (record === undefined) {
      return false;
    }

    const url = this.#editors.pageUrl(
      record.kind,
      assetId
    );
    if (url === undefined) {
      return false;
    }

    return this.tabs.open(
      {
        id: assetId,
        ...this.#tabTitle(record),
        url,
        icon: this.kinds.kindIcon(record.kind)
      },
      options
    );
  }

  async restoreTabs(): Promise<void> {
    const saved = this.#browserState.tabs;

    this.#restoring = true;
    try {
      for (const id of saved.ids) {
        if (this.tabs.size >= this.tabs.cap) {
          break;
        }

        await this.openAsset(
          id,
          { focus: false }
        );
      }
      for (const id of saved.pages) {
        this.tabs.openPage(id);
      }
    }
    finally {
      this.#restoring = false;
    }
    if (!this.tabs.focus(saved.active)) {
      this.#saveTabs();
    }
  }

  reloadEditor(
    name: string
  ): void {
    for (const assetId of this.tabs.ids()) {
      const record = this.#catalog.record(assetId);
      if (
        record !== undefined &&
        this.#editors.findEditor(record.kind)?.name === name
      ) {
        this.tabs.reload(assetId);
      }
    }
  }

  dispose(): void {
    this.#listening.abort();
    this.#catalog.off("change", this.#syncTabs);
    this.#stopRenewal?.();
    this.tabs.dispose();
    this.#frames.dispose();
  }

  #tabTitle(
    record: AssetRecordData
  ): EditorTabTitle {
    const path = AssetPath.parse(record.path);

    return {
      label: this.kinds.trimExtension(record.kind, path.name),
      tooltip: path.toString()
    };
  }

  readonly #onShellCommand = (
    command: ShellCommand,
    from: string
  ): void => {
    switch (command.command) {
      case "open-asset":
        void this.openAsset(command.target);
        break;
      case "toggle-console":
        this.toggleConsole();
        break;
      case "session-refused":
        void this.#renewal?.renew();
        break;
      case "unsaved":
        this.tabs.markUnsaved(from, command.unsaved);
        break;
      case "editor-state":
        this.tabs.markState(from, command.state);
        break;
      case "update-preferences":
        this.#updatePreferences(command.scope, command.patch);
        break;
      default: {
        const unhandled: never = command;
        throw new Error(
          `Unhandled shell command: ${JSON.stringify(unhandled)}`
        );
      }
    }
  };

  #updatePreferences(
    name: string,
    patch: PreferenceOverrides
  ): void {
    const scope = this.#preferences.scopes.find(name);
    if (scope === undefined) {
      return;
    }

    try {
      this.#preferences.values.update(scope, patch);
    }
    catch (error) {
      if (!(error instanceof InvalidPreferencesError)) {
        throw error;
      }
      this.#frames.sharePreferences(scope.name);
    }
  }

  readonly #onBeforeUnload = (
    event: BeforeUnloadEvent
  ): void => {
    if (this.tabs.unsaved) {
      event.preventDefault();
    }
  };

  readonly #onChange = (): void => {
    this.#saveTabs();
    this.#onTabsChange?.();
  };

  readonly #saveTabs = (): void => {
    if (this.#restoring) {
      return;
    }

    this.#browserState.tabs = new SavedTabs(
      this.tabs.ids(),
      this.tabs.active,
      this.tabs.openPages()
    );
  };

  readonly #syncTabs = (): void => {
    for (const assetId of this.tabs.ids()) {
      const record = this.#catalog.record(assetId);
      if (record === undefined) {
        this.tabs.close(assetId);
      }
      else {
        this.tabs.relabel(
          assetId,
          this.#tabTitle(record)
        );
      }
    }
    this.#onTabsChange?.();
  };
}
