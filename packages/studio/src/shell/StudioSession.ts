// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { ShellCommand } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { AssetKindSet } from "../catalog/AssetKindSet.ts";
import { AssetPath } from "../catalog/AssetPath.ts";
import type { EditorRegistry } from "../editors/EditorRegistry.ts";
import {
  EditorTabs,
  type EditorTabsOptions
} from "../tabs/EditorTabs.ts";

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
  tabs: Omit<EditorTabsOptions, "onShellCommand">;
}

export class StudioSession {
  readonly kinds: AssetKindSet;
  readonly tabs: EditorTabs;

  #catalog: StudioCatalog;
  #editors: EditorRegistry;

  constructor(
    options: StudioSessionOptions
  ) {
    this.#catalog = options.catalog;
    this.#editors = options.editors;
    this.kinds = options.editors.kindSet();
    this.tabs = new EditorTabs({
      ...options.tabs,
      onShellCommand: this.#onShellCommand
    });
    this.#catalog.on("change", this.#syncTabs);
  }

  async openAsset(
    assetId: string
  ): Promise<boolean> {
    const record = this.#catalog.record(assetId);
    if (record === undefined) {
      return false;
    }

    const url = this.#editors.pageUrl(record.kind, assetId);
    if (url === undefined) {
      return false;
    }

    return this.tabs.open({
      id: assetId,
      label: AssetPath.parse(record.source).name,
      url,
      icon: this.kinds.iconFor(record.kind)
    });
  }

  dispose(): void {
    this.#catalog.off("change", this.#syncTabs);
    this.tabs.dispose();
  }

  readonly #onShellCommand = (
    command: ShellCommand
  ): void => {
    if (command.command === "open-asset") {
      void this.openAsset(command.target);
    }
  };

  readonly #syncTabs = (): void => {
    for (const assetId of this.tabs.ids()) {
      const record = this.#catalog.record(assetId);
      if (record === undefined) {
        this.tabs.close(assetId);
      }
      else {
        const recordLabel = AssetPath.parse(record.source).name;

        this.tabs.relabel(
          assetId,
          recordLabel
        );
      }
    }
  };
}
