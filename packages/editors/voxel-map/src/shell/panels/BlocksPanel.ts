// Import Third-party Dependencies
import { html, css } from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import {
  LocalStorageAdapter,
  SearchQuery,
  type Folder,
  type JollyChangeDetail,
  type StorageAdapter
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/search";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../editing/EditingElement.ts";
import { BlockLibraryOrder } from "../../features/blocks/library/BlockLibraryOrder.ts";
import { BlockLibraryScope } from "../../features/blocks/library/BlockLibraryScope.ts";
import { BlockLibraryView } from "../../features/blocks/library/BlockLibraryView.ts";
import type {
  BlockLibrarySettingsChangeDetail
} from "../../features/blocks/library/BlockLibrarySettings.ts";
import "../../features/blocks/library/BlockLibrary.ts";
import "../../features/blocks/library/BlockLibrarySettings.ts";
import "../../features/painting/toolbar/BrushOrientation.ts";

// CONSTANTS
const kOrderStorageKey = "voxel-map:block-library:order";
const kScopeStorageKey = "voxel-map:block-library:scope";

@customElement("blocks-panel")
export class BlocksPanel extends EditingElement {
  static override styles = css`
    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }

    jolly-folder {
      flex: 0 0 auto;
    }

    :host(:not([hosts-texture-editor])) jolly-folder.library[open] {
      flex: 1 1 auto;
      min-height: 0;
    }

    jolly-search[expanded] {
      flex: 0 1 200px;
      min-width: 64px;
    }

    brush-orientation {
      margin: 0 0 var(--jolly-space-1, 4px) var(--jolly-space-1, 4px);
    }
  `;

  @property({
    type: Boolean,
    reflect: true,
    attribute: "hosts-texture-editor"
  })
  declare hostsTextureEditor: boolean;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @state()
  declare _view: BlockLibraryView;

  @query("jolly-folder.library")
  declare _library: Folder | null;

  constructor() {
    super();
    this.hostsTextureEditor = false;
    this.storage = new LocalStorageAdapter();
    this._view = BlockLibraryView.Default.with({
      order: BlockLibraryOrder.parse(this.storage.get(kOrderStorageKey)),
      scope: BlockLibraryScope.parse(this.storage.get(kScopeStorageKey))
    });
  }

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    return [
      editing.editorMap.subscribe(
        "reset",
        () => this.requestUpdate()
      ),
      editing.blocksets.subscribe(
        "change",
        () => this.requestUpdate()
      ),
      editing.blocksets.subscribe(
        "activeChange",
        () => this.requestUpdate()
      )
    ];
  }

  readonly #onSettingsChange = (
    event: CustomEvent<BlockLibrarySettingsChangeDetail>
  ): void => {
    const { order, scope } = event.detail;
    this._view = this._view.with({ order, scope });

    this.storage.set(kOrderStorageKey, order.value);
    this.storage.set(kScopeStorageKey, scope.value);
  };

  readonly #onSearchInput = (
    event: CustomEvent<JollyChangeDetail<string>>
  ): void => {
    const search = new SearchQuery(event.detail.value);
    if (search.equals(this._view.search)) {
      return;
    }

    this._view = this._view.with({ search });
    if (!search.isEmpty && this._library !== null) {
      this._library.open = true;
    }
  };

  override render() {
    const editing = this.editing;
    if (editing === null) {
      return html`<slot></slot>`;
    }

    return html`
      <jolly-folder
        class="library"
        flush
        key="block-library"
        label="Block Library"
        storage-key="voxel-map:folder:block-library"
      >
        <jolly-search
          slot="actions"
          compact
          label="Search blocks"
          placeholder="Search blocks"
          @jolly-input=${this.#onSearchInput}
        ></jolly-search>
        <block-library-settings
          slot="actions"
          .order=${this._view.order}
          .scope=${this._view.scope}
          .activeBlockset=${editing.blocksets.active?.label ?? null}
          @block-library-settings-change=${this.#onSettingsChange}
        ></block-library-settings>
        <block-library
          .editing=${editing}
          .view=${this._view}
          .layout=${this.hostsTextureEditor ? "compact" : "fill"}
        >
          <brush-orientation .editing=${editing}></brush-orientation>
        </block-library>
      </jolly-folder>

      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "blocks-panel": BlocksPanel;
  }
}
