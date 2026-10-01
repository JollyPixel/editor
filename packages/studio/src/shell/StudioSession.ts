// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { ShellCommand } from "@jolly-pixel/editor.host";
import {
  LocalStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetKindSet } from "../catalog/AssetKindSet.ts";
import { AssetPath } from "../catalog/AssetPath.ts";
import type { EditorRegistry } from "../editors/EditorRegistry.ts";
import {
  EditorTabs,
  type EditorTabOpenOptions,
  type EditorTabsOptions,
  type EditorTabTitle
} from "../tabs/EditorTabs.ts";
import { SavedTabs } from "../tabs/SavedTabs.ts";

// CONSTANTS
export const TABS_STORAGE_KEY = "studio:tabs";

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

export interface StudioSessionOptions {
  catalog: StudioCatalog;
  editors: EditorRegistry;
  tabs: Omit<EditorTabsOptions, "onShellCommand" | "onChange">;
  onTabsChange?: () => void;
  /**
   * @default new LocalStorageAdapter()
   */
  storage?: StorageAdapter;
}

export class StudioSession {
  readonly kinds: AssetKindSet;
  readonly tabs: EditorTabs;

  #catalog: StudioCatalog;
  #editors: EditorRegistry;
  #storage: StorageAdapter;
  #onTabsChange: (() => void) | undefined;
  #restoring = false;

  constructor(
    options: StudioSessionOptions
  ) {
    this.#catalog = options.catalog;
    this.#editors = options.editors;
    this.#storage = options.storage ?? new LocalStorageAdapter();
    this.#onTabsChange = options.onTabsChange;
    this.kinds = options.editors.kindSet();
    this.tabs = new EditorTabs({
      ...options.tabs,
      onShellCommand: this.#onShellCommand,
      onChange: this.#onChange
    });
    this.#catalog.on("change", this.#syncTabs);
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
    const saved = SavedTabs.parse(
      this.#storage.get(TABS_STORAGE_KEY)
    );

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
    this.tabs.dispose();
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
    if (command.command === "open-asset") {
      void this.openAsset(command.target);
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

    const saved = new SavedTabs(
      this.tabs.ids(),
      this.tabs.active
    );
    this.#storage.set(
      TABS_STORAGE_KEY,
      JSON.stringify(saved)
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
