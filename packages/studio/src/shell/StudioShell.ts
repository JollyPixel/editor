// Import Third-party Dependencies
import type { CatalogClient } from "@jolly-pixel/asset-server/catalog/client";
import type { ShellCommand } from "@jolly-pixel/editor.host";
import type { IconName } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  assetIdOf,
  assetName,
  assetTree,
  folderIds,
  type AssetTreeNode
} from "../catalog/assetTree.ts";
import {
  editorPageFor,
  editorPageUrl
} from "../editors/editorRegistry.ts";
import type { EditorTabs } from "../tabs/EditorTabs.ts";

// CONSTANTS
const kNoEditorDetail = "no editor";

export interface AssetTreeElement extends HTMLElement {
  nodes: AssetTreeNode[];
  expanded: string[];
  indentGuides: boolean;
}

export interface StudioShellOptions {
  catalog: CatalogClient;
  tree: AssetTreeElement;
  tabs: EditorTabs;
  pages?: ReadonlyMap<string, string>;
  iconFor?: (kind: string) => IconName | undefined;
}

export class StudioShell {
  readonly tabs: EditorTabs;

  #catalog: CatalogClient;
  #tree: AssetTreeElement;
  #pages: ReadonlyMap<string, string> | undefined;
  #iconFor: ((kind: string) => IconName | undefined) | undefined;
  #expanded: Set<string> | null = null;
  #listening = new AbortController();

  constructor(
    options: StudioShellOptions
  ) {
    this.tabs = options.tabs;
    this.#catalog = options.catalog;
    this.#tree = options.tree;
    this.#pages = options.pages;
    this.#iconFor = options.iconFor;

    const { signal } = this.#listening;
    this.#tree.indentGuides = true;
    this.#tree.addEventListener("jolly-activate", (event) => {
      const assetId = assetIdOf(event.detail.id);
      if (assetId !== undefined) {
        void this.openAsset(assetId);
      }
    }, { signal });
    this.#tree.addEventListener("jolly-toggle-expand", (event) => {
      const expanded = this.#expanded ?? new Set<string>();
      if (event.detail.expanded) {
        expanded.add(event.detail.id);
      }
      else {
        expanded.delete(event.detail.id);
      }
      this.#expanded = expanded;
      this.#tree.expanded = [...expanded];
    }, { signal });
    this.#catalog.on("change", this.#render);
    this.#render();
  }

  canOpen(
    kind: string
  ): boolean {
    return editorPageFor(kind, this.#pages) !== undefined;
  }

  openAsset(
    assetId: string
  ): Promise<boolean> {
    const record = this.#catalog.record(assetId);
    const page = record === undefined ?
      undefined :
      editorPageFor(record.kind, this.#pages);
    if (record === undefined || page === undefined) {
      return Promise.resolve(false);
    }

    return this.tabs.open({
      id: assetId,
      label: assetName(record.source),
      url: editorPageUrl(page, assetId)
    });
  }

  handleShellCommand(
    command: ShellCommand
  ): void {
    if (command.command === "open-asset") {
      void this.openAsset(command.target);
    }
  }

  dispose(): void {
    this.#listening.abort();
    this.#catalog.off("change", this.#render);
    this.tabs.dispose();
  }

  readonly #render = (): void => {
    const nodes = assetTree(this.#catalog.records(), {
      iconFor: this.#iconFor,
      detailFor: (kind) => (this.canOpen(kind) ? undefined : kNoEditorDetail)
    });
    this.#tree.nodes = nodes;
    this.#expanded ??= new Set(folderIds(nodes));
    this.#tree.expanded = [...this.#expanded];

    for (const assetId of this.tabs.ids()) {
      const record = this.#catalog.record(assetId);
      if (record === undefined) {
        this.tabs.close(assetId);
      }
      else {
        this.tabs.relabel(assetId, assetName(record.source));
      }
    }
  };
}
