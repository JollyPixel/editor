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
  property,
  query,
  state
} from "lit/decorators.js";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import { askImportConflictPolicy } from "@jolly-pixel/editor.host";
import type {
  JollyChangeDetail,
  JollyOption,
  JollyReparentDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import type { AssetPath } from "../../catalog/AssetPath.ts";
import { summarizeSelection } from "../../catalog/AssetSummary.ts";
import {
  AssetSelection,
  isAssetAction,
  parseNewAssetKind,
  type AssetAction
} from "../../catalog/AssetSelection.ts";
import { AssetTreeModel } from "../../catalog/AssetTreeModel.ts";
import type { StudioPreferences } from "../../preferences/StudioPreferences.ts";
import type { StudioShareLinks } from "../../shares/StudioShareLinks.ts";
import { cardStyles } from "../cardStyles.ts";
import { StudioErrorEvent } from "../StudioErrorEvent.ts";
import type { AssetDeleteDialog } from "./AssetDeleteDialog.ts";
import type { AssetShareDialog } from "./AssetShareDialog.ts";
import { askConversion } from "./askConversion.ts";
import { assetOpenEvent } from "./assetOpen.ts";
import {
  AssetTreeView,
  type AssetDropQuestions
} from "./AssetTreeView.ts";
import {
  assetMenu,
  newAssetMenu
} from "./assetMenu.ts";
import "./AssetDeleteDialog.ts";
import "./AssetDetails.ts";
import "./AssetShareDialog.ts";

// CONSTANTS
const kNoKindOptions: readonly JollyOption<string>[] = [];
const kFilesType = "Files";
const kDropQuestions: AssetDropQuestions = {
  conversion: askConversion,
  conflicts: askImportConflictPolicy
};

export interface AssetBrowserOptions {
  catalog: CatalogClient;
  kinds: AssetKindSet;
  shares: StudioShareLinks | null;
  preferences: StudioPreferences;
}

interface AssetSharing {
  links: StudioShareLinks;
  catalog: CatalogClient;
}

@customElement("asset-browser")
export class AssetBrowser extends LitElement {
  static override styles = [
    cardStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--studio-gutter);
        height: 100%;
        box-sizing: border-box;

        --kind-selected-bg: color-mix(
          in oklab,
          var(--jolly-accent-fill) 40%,
          transparent
        );
        --kind-selected-bg-hover: color-mix(
          in oklab,
          var(--jolly-accent-fill) 50%,
          transparent
        );
      }

      .browser {
        position: relative;
        flex: 1 1 0;
      }

      .browser.dropping {
        box-shadow:
          var(--studio-bevel),
          inset 0 0 0 2px var(--jolly-accent-fill);
      }

      .drop-hint {
        position: absolute;
        inset-inline: var(--jolly-space-2);
        bottom: var(--jolly-space-2);
        padding: var(--jolly-space-1) var(--jolly-space-2);
        overflow: hidden;
        border-radius: var(--jolly-radius-sm);
        background: var(--jolly-accent-fill);
        color: var(--jolly-text-on-fill);
        text-align: center;
        text-overflow: ellipsis;
        white-space: nowrap;
        pointer-events: none;
      }

      .browser .card-head {
        padding-inline: var(--jolly-space-2);
      }

      .kinds {
        flex: 1;

        --jolly-field-inset-start: 0;
        --jolly-field-inset-end: 0;
        --jolly-control-height: 24px;
        --jolly-icon-size: 30px;
        --jolly-accent-fill: var(--kind-selected-bg);
        --jolly-accent-fill-hover: var(--kind-selected-bg-hover);
        --jolly-accent-fill-focus: var(--kind-selected-bg-hover);
        --jolly-text-on-fill: var(--jolly-accent-text);
      }

      jolly-toolbar {
        padding: 0 var(--jolly-space-2) var(--jolly-space-1);
        border-block-end: 1px solid
          color-mix(in oklab, var(--jolly-border) 70%, transparent);

        --jolly-control-bg: transparent;
        --jolly-invalid-bg: transparent;
        --jolly-icon-button-size: 26px;
        --jolly-control-height: 26px;
      }

      jolly-toolbar .rename {
        margin-inline-start: auto;
      }

      jolly-tree {
        flex: 1 1 0;
        min-height: 0;
        padding: var(--jolly-space-1) var(--jolly-space-1) 0;

        --jolly-tree-icon-size: 16px;
      }

      asset-details {
        flex: 0 0 168px;
      }

      asset-delete-dialog,
      asset-share-dialog {
        position: absolute;
      }
    `
  ];

  @property({ attribute: false })
  declare options: AssetBrowserOptions | null;

  @query("jolly-tree")
  declare _tree: HTMLElementTagNameMap["jolly-tree"] | null;

  @query("asset-delete-dialog")
  declare _deleteDialog: AssetDeleteDialog;

  @query("asset-share-dialog")
  declare _shareDialog: AssetShareDialog;

  @query("jolly-context-menu")
  declare _menu: HTMLElementTagNameMap["jolly-context-menu"];

  @query(".new-asset")
  declare _newAssetButton: HTMLElement;

  @state()
  declare _dropFolder: AssetPath | null;

  #view: AssetTreeView | null = null;
  #bound: AssetBrowserOptions | null = null;
  #menuTarget: AssetSelection | null = null;

  constructor() {
    super();
    this.options = null;
    this._dropFolder = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#bind();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#bind();
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("options")) {
      this.#bind();
    }
    this.#view?.refresh();
  }

  override render(): TemplateResult {
    const view = this.#view;
    const selection = this.#selection();

    const dropFolder = this._dropFolder;

    return html`
      <div
        class="card browser ${dropFolder === null ? "" : "dropping"}"
        @dragover=${this.#onDragOver}
        @dragleave=${this.#onDragLeave}
        @drop=${this.#onDrop}
      >
        <div class="card-head">
          <jolly-button-group
            class="kinds"
            icon-only
            layout="grid"
            aria-label="Asset kind"
            .columns=${view?.kindOptions.length ?? 0}
            .options=${view?.kindOptions ?? kNoKindOptions}
            .value=${view?.kind ?? ""}
            @jolly-change=${this.#onKindChange}
          ></jolly-button-group>
        </div>
        <jolly-toolbar label="Asset actions">
          <jolly-button
            class="new-asset"
            icon="plus"
            icon-only
            label="New asset"
            title="New asset"
            ?disabled=${this.#kinds.entries.length === 0}
            @click=${this.#openNewAssetMenu}
          ></jolly-button>
          <jolly-button
            icon="new-folder"
            icon-only
            label="New folder"
            title="New folder"
            @click=${this.#newFolder}
          ></jolly-button>
          <jolly-button
            class="rename"
            icon="pencil"
            icon-only
            label="Rename"
            title="Rename (F2)"
            ?disabled=${!selection.allows("rename")}
            @click=${this.#beginRename}
          ></jolly-button>
          <jolly-button
            icon="trash"
            icon-only
            variant="danger"
            label="Delete"
            title="Delete (Del)"
            ?disabled=${!selection.allows("delete")}
            @click=${this.#deleteSelected}
          ></jolly-button>
          <jolly-button
            icon="export"
            icon-only
            label="Export"
            title="Export as a ZIP archive"
            ?disabled=${!selection.allows("export")}
            @click=${this.#exportSelected}
          ></jolly-button>
          ${this.#sharing === null ? nothing : html`
            <jolly-button
              icon="share"
              icon-only
              label="Share"
              title="Share a view-only link"
              ?disabled=${!selection.allows("share")}
              @click=${this.#shareSelected}
            ></jolly-button>
          `}
        </jolly-toolbar>
        <jolly-tree
          virtual
          multiple
          renamable
          reorderable
          row-drag
          activate-on-double-click
          .nodes=${view?.nodes ?? AssetTreeModel.EMPTY.nodes}
          .expanded=${[...view?.expanded ?? []]}
          .selected=${view?.selected ?? []}
          .acceptDrop=${this.#acceptDrop}
          @jolly-select=${this.#onSelect}
          @jolly-toggle-expand=${this.#onToggleExpand}
          @jolly-activate=${this.#onActivate}
          @jolly-rename=${this.#onRename}
          @jolly-reparent=${this.#onReparent}
          @jolly-context-request=${this.#onContextRequest}
          @keydown=${this.#onKeyDown}
        ></jolly-tree>
        ${dropFolder === null ? nothing : html`
          <div class="drop-hint">Drop to add to ${dropFolder.isRoot ?
            "the project root" :
            `"${dropFolder}"`}</div>
        `}
      </div>
      <asset-details
        class="card"
        .summary=${summarizeSelection(selection, this.#kinds)}
      ></asset-details>
      <jolly-context-menu
        label="Asset actions"
        @jolly-context-action=${this.#onContextAction}
      ></jolly-context-menu>
      <asset-delete-dialog></asset-delete-dialog>
      <asset-share-dialog></asset-share-dialog>
    `;
  }

  get #sharing(): AssetSharing | null {
    const options = this.#bound;
    const links = options?.shares ?? null;

    return options === null || links === null ?
      null :
      {
        links,
        catalog: options.catalog
      };
  }

  get #kinds(): AssetKindSet {
    return this.options?.kinds ?? AssetKindSet.EMPTY;
  }

  #bind(): void {
    const options = this.isConnected ? this.options : null;
    if (options === this.#bound) {
      return;
    }

    this.#view?.dispose();
    this.#bound = options;
    this.#view = options === null ? null : new AssetTreeView({
      catalog: options.catalog,
      kinds: options.kinds,
      preferences: options.preferences,
      onChange: () => this.requestUpdate(),
      onError: (message) => this.#error(message),
      onCreated: (nodeId) => {
        void this.#beginRenameNode(nodeId);
      }
    });
    this.requestUpdate();
  }

  #selection(
    nodeIds?: Iterable<string>
  ): AssetSelection {
    return this.#view?.selection(nodeIds) ??
      new AssetSelection(AssetTreeModel.EMPTY, []);
  }

  #run(
    action: AssetAction,
    target: AssetSelection
  ): void {
    const view = this.#view;
    const selection = this.#selection(target.nodeIds);
    if (view === null || !selection.allows(action)) {
      return;
    }

    const { asset, folder, nodeIds } = selection;
    switch (action) {
      case "open":
        if (asset !== null) {
          this.#open(asset.id);
        }
        break;
      case "new-folder":
        void view.createFolder(folder);
        break;
      case "rename":
        this._tree?.beginRename(nodeIds[0]);
        break;
      case "export":
        if (asset !== null) {
          void view.export(asset);
        }
        break;
      case "share": {
        const sharing = this.#sharing;
        if (asset !== null && sharing !== null) {
          void this._shareDialog.open(asset, sharing.links, sharing.catalog);
        }
        break;
      }
      case "delete":
        void view.remove(
          nodeIds,
          (deletion) => this._deleteDialog.open(deletion)
        );
        break;
      default:
        break;
    }
  }

  #open(
    assetId: string
  ): void {
    this.dispatchEvent(assetOpenEvent(assetId));
  }

  async #beginRenameNode(
    nodeId: string
  ): Promise<void> {
    await this.updateComplete;
    await this._tree?.updateComplete;
    this._tree?.beginRename(nodeId);
  }

  #error(
    message: string
  ): void {
    this.dispatchEvent(new StudioErrorEvent(message));
  }

  readonly #onKindChange = (
    event: CustomEvent<JollyChangeDetail<string>>
  ): void => {
    this.#view?.filter(event.detail.value);
  };

  readonly #newFolder = (): void => {
    this.#run("new-folder", this.#selection());
  };

  readonly #shareSelected = (): void => {
    this.#run("share", this.#selection());
  };

  readonly #exportSelected = (): void => {
    this.#run("export", this.#selection());
  };

  readonly #acceptDrop = (
    detail: JollyReparentDetail
  ): boolean => this.#view?.acceptsDrop(detail) ?? false;

  #dropFolderAt(
    event: DragEvent
  ): AssetPath {
    const row = event.composedPath().find(
      (target) => target instanceof HTMLElement &&
        target.getAttribute("role") === "treeitem"
    );
    const nodeId = row instanceof HTMLElement ? row.dataset.id : undefined;

    return this.#selection(nodeId === undefined ? [] : [nodeId]).folder;
  }

  readonly #onDragOver = (
    event: DragEvent
  ): void => {
    const transfer = event.dataTransfer;
    if (this.#view === null || !transfer?.types.includes(kFilesType)) {
      return;
    }

    event.preventDefault();
    transfer.dropEffect = "copy";
    const folder = this.#dropFolderAt(event);
    if (this._dropFolder === null || !this._dropFolder.equals(folder)) {
      this._dropFolder = folder;
    }
  };

  readonly #onDragLeave = (
    event: DragEvent
  ): void => {
    const card = event.currentTarget;
    const next = event.relatedTarget;
    if (
      !(card instanceof Node) ||
      !(next instanceof Node) ||
      !card.contains(next)
    ) {
      this._dropFolder = null;
    }
  };

  readonly #onDrop = (
    event: DragEvent
  ): void => {
    const view = this.#view;
    const files = [...event.dataTransfer?.files ?? []];
    this._dropFolder = null;
    if (view === null || files.length === 0) {
      return;
    }

    event.preventDefault();
    void view.importFiles(this.#dropFolderAt(event), files, kDropQuestions);
  };

  readonly #onSelect = (
    event: HTMLElementEventMap["jolly-select"]
  ): void => {
    this.#view?.select(event.detail.selected);
  };

  readonly #onToggleExpand = (
    event: HTMLElementEventMap["jolly-toggle-expand"]
  ): void => {
    this.#view?.toggle(event.detail.id, event.detail.expanded);
  };

  readonly #onActivate = (
    event: HTMLElementEventMap["jolly-activate"]
  ): void => {
    const nodeId = event.detail.id;
    const data = this.#view?.model.node(nodeId)?.data;
    if (data?.type === "folder") {
      this.#view?.toggle(nodeId);
    }
    else if (data?.type === "asset") {
      this.#open(data.id);
    }
  };

  readonly #onRename = (
    event: HTMLElementEventMap["jolly-rename"]
  ): void => {
    void this.#view?.rename(event.detail.id, event.detail.name);
  };

  readonly #onReparent = (
    event: HTMLElementEventMap["jolly-reparent"]
  ): void => {
    void this.#view?.move(event.detail);
  };

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.key === "Delete") {
      event.preventDefault();
      this.#deleteSelected();
    }
  };

  readonly #onContextRequest = (
    event: HTMLElementEventMap["jolly-context-request"]
  ): void => {
    const { id, x, y } = event.detail;
    const target = this.#selection(
      id === null ? [] : this.#view?.selected ?? []
    );
    this.#menuTarget = target;
    this._menu.items = assetMenu(target, this.#kinds, this.#sharing !== null);
    this._menu.openAt(x, y);
  };

  readonly #openNewAssetMenu = (): void => {
    const anchor = this._newAssetButton.getBoundingClientRect();
    this.#menuTarget = this.#selection();
    this._menu.items = newAssetMenu(this.#kinds);
    this._menu.openAt(anchor.left, anchor.bottom);
  };

  readonly #onContextAction = (
    event: HTMLElementEventMap["jolly-context-action"]
  ): void => {
    const target = this.#menuTarget;
    const action = event.detail.id;
    this.#menuTarget = null;
    if (target === null) {
      return;
    }

    const kind = parseNewAssetKind(action);
    if (kind !== null) {
      void this.#view?.createAsset(
        kind,
        this.#selection(target.nodeIds).folder
      );
    }
    else if (isAssetAction(action)) {
      this.#run(action, target);
    }
  };

  readonly #beginRename = (): void => {
    this.#run("rename", this.#selection());
  };

  readonly #deleteSelected = (): void => {
    this.#run("delete", this.#selection());
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "asset-browser": AssetBrowser;
  }
}
