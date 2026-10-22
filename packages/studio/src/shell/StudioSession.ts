// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import {
  FrameConsoles,
  type FrameConsolesOptions,
  type LaunchIdentity,
  type ShellCommand
} from "@jolly-pixel/editor.host";
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
  type EditorTabTitle,
  type TabStrip
} from "../tabs/EditorTabs.ts";
import { SavedTabs } from "../tabs/SavedTabs.ts";

// CONSTANTS
export const SETTINGS_TAB_ID = "studio:settings";

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

export interface StudioSessionUser {
  readonly identity: LaunchIdentity | null;
  /**
   * What frames read with their launch and change with `update-preferences`.
   */
  readonly preferences: Preferences;
  readonly renewal: StudioSessionRenewal | null;
}

export interface StudioSessionConsole {
  readonly element: {
    toggle(): void;
  };
  /**
   * Mirrors the active frame's console namespaces when given.
   */
  readonly commands?: FrameConsolesOptions["commands"];
}

export interface StudioSessionSlots {
  strip: TabStrip;
  frames: HTMLElement;
  home: HTMLElement;
  settings: HTMLElement;
}

export interface StudioSessionOptions extends Pick<
  EditorTabsOptions,
  "cap" | "confirmEvict" | "confirmClose"
> {
  catalog: StudioCatalog;
  share: EditorFramesOptions["share"];
  user: StudioSessionUser;
  scopes: PreferenceScopes;
  editors: EditorRegistry;
  slots: StudioSessionSlots;
  console?: StudioSessionConsole;
  onTabsChange?: () => void;
  /**
   * @default new BrowserState()
   */
  browserState?: BrowserState;
  /**
   * @default location.origin
   */
  launchOrigin?: string;
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
  #user: StudioSessionUser;
  #scopes: PreferenceScopes;
  #stopRenewal: (() => void) | undefined;
  #restoring = false;
  #listening = new AbortController();

  constructor(
    options: StudioSessionOptions
  ) {
    const { slots, user } = options;
    this.#catalog = options.catalog;
    this.#editors = options.editors;
    this.#browserState = options.browserState ?? new BrowserState();
    this.#onTabsChange = options.onTabsChange;
    this.#console = options.console;
    this.#user = user;
    this.#scopes = options.scopes;
    this.kinds = options.editors.kindSet();
    const commands = options.console?.commands;
    this.#frames = new EditorFrames({
      container: slots.frames,
      launchOrigin: options.launchOrigin,
      share: options.share,
      identity: () => user.identity,
      consoles: commands === undefined ?
        undefined :
        new FrameConsoles({ commands }),
      preferences: user.preferences,
      scopes: options.scopes,
      onShellCommand: this.#onShellCommand
    });
    this.tabs = new EditorTabs({
      strip: slots.strip,
      home: slots.home,
      pages: [
        {
          id: SETTINGS_TAB_ID,
          label: "Settings",
          icon: "settings",
          element: slots.settings
        }
      ],
      cap: options.cap,
      confirmEvict: options.confirmEvict,
      confirmClose: options.confirmClose,
      frames: this.#frames,
      onChange: this.#onChange
    });
    this.#catalog.on("change", this.#syncTabs);
    this.#stopRenewal = user.renewal?.onRenewed(
      () => this.#frames.notifySessionRenewed()
    );
    window.addEventListener("beforeunload", this.#onBeforeUnload, {
      signal: this.#listening.signal
    });
  }

  toggleConsole(): void {
    this.#console?.element.toggle();
  }

  openSettings(): void {
    this.tabs.openPage(SETTINGS_TAB_ID);
  }

  async openAsset(
    assetId: string,
    options: EditorTabOpenOptions = {}
  ): Promise<boolean> {
    const record = this.#catalog.record(assetId);
    if (record === undefined) {
      return false;
    }

    const editor = this.#editors.findEditor(record.kind);
    if (editor === undefined) {
      return false;
    }

    return this.tabs.open(
      {
        id: assetId,
        editor: editor.name,
        ...this.#tabTitle(record),
        url: this.#editors.pageUrl(editor.name, assetId),
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
        void this.#user.renewal?.renew();
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
    const scope = this.#scopes.find(name);
    if (scope === undefined) {
      return;
    }

    try {
      this.#user.preferences.update(scope, patch);
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
