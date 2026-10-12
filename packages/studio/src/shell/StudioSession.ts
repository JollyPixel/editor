// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { ShellCommand } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { AssetKindSet } from "../catalog/AssetKindSet.ts";
import { AssetPath } from "../catalog/AssetPath.ts";
import type { EditorRegistry } from "../editors/EditorRegistry.ts";
import { StudioPreferences } from "../preferences/StudioPreferences.ts";
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

export interface StudioSessionConsole {
  toggle(): void;
}

export interface StudioSessionOptions {
  catalog: StudioCatalog;
  editors: EditorRegistry;
  tabs: Omit<EditorTabsOptions, "frames" | "onChange">;
  frames: Omit<EditorFramesOptions, "onShellCommand">;
  onTabsChange?: () => void;
  console?: StudioSessionConsole;
  renewal?: StudioSessionRenewal;
  /**
   * @default new StudioPreferences()
   */
  preferences?: StudioPreferences;
}

export class StudioSession {
  readonly kinds: AssetKindSet;
  readonly tabs: EditorTabs;

  #catalog: StudioCatalog;
  #frames: EditorFrames;
  #editors: EditorRegistry;
  #preferences: StudioPreferences;
  #onTabsChange: (() => void) | undefined;
  #console: StudioSessionConsole | undefined;
  #renewal: StudioSessionRenewal | undefined;
  #stopRenewal: (() => void) | undefined;
  #restoring = false;

  constructor(
    options: StudioSessionOptions
  ) {
    this.#catalog = options.catalog;
    this.#editors = options.editors;
    this.#preferences = options.preferences ?? new StudioPreferences();
    this.#onTabsChange = options.onTabsChange;
    this.#console = options.console;
    this.#renewal = options.renewal;
    this.kinds = options.editors.kindSet();
    this.#frames = new EditorFrames({
      ...options.frames,
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
        ...this.#titleOf(record),
        url,
        icon: this.kinds.iconFor(record.kind)
      },
      options
    );
  }

  async restoreTabs(): Promise<void> {
    const saved = this.#preferences.tabs;

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
        this.#editors.editorFor(record.kind)?.name === name
      ) {
        this.tabs.reload(assetId);
      }
    }
  }

  dispose(): void {
    this.#catalog.off("change", this.#syncTabs);
    this.#stopRenewal?.();
    this.tabs.dispose();
    this.#frames.dispose();
  }

  #titleOf(
    record: AssetRecordData
  ): EditorTabTitle {
    const path = AssetPath.parse(record.source);

    return {
      label: this.kinds.displayNameFor(record.kind, path.name),
      tooltip: path.toString()
    };
  }

  readonly #onShellCommand = (
    command: ShellCommand
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
      default: {
        const unhandled: never = command;
        throw new Error(
          `Unhandled shell command: ${JSON.stringify(unhandled)}`
        );
      }
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

    this.#preferences.tabs = new SavedTabs(
      this.tabs.ids(),
      this.tabs.active
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
          this.#titleOf(record)
        );
      }
    }
    this.#onTabsChange?.();
  };
}
