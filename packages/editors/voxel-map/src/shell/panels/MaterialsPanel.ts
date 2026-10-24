// Import Third-party Dependencies
import { html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "@jolly-pixel/ui/elements/folder";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../editing/EditingElement.ts";
import { hintStyles } from "../../shared/styles/hint.styles.ts";
import "../../features/blocks/library/BlockLibrary.ts";
import "../../features/materials/MaterialLibrary.ts";
import "./MapConfigPanel.ts";

@customElement("materials-panel")
export class MaterialsPanel extends EditingElement {
  static override styles = [
    hintStyles,
    css`
      :host {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-height: 0;
      }

      jolly-folder {
        flex: 0 0 auto;
      }

      material-library {
        flex-shrink: 0;
      }
    `
  ];

  @property({
    type: Boolean,
    reflect: true,
    attribute: "shows-block-library"
  })
  declare showsBlockLibrary: boolean;

  @state()
  declare _hasBlocks: boolean;

  constructor() {
    super();
    this.showsBlockLibrary = true;
    this._hasBlocks = false;
  }

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    const { editorMap } = editing;
    const refresh = (): void => {
      this._hasBlocks = editorMap.blocks.size > 0;
    };
    refresh();

    return [
      editorMap.subscribe("blockRegistryChanged", refresh),
      editorMap.subscribe("reset", refresh)
    ];
  }

  override render() {
    const editing = this.editing;
    if (editing === null) {
      return html``;
    }

    return html`
      ${this._hasBlocks ?
        this.#renderMaterials(editing) :
        html`<p class="hint">Add a block to the map to edit materials.</p>`}
      <jolly-folder
        flush
        key="map-config"
        label="View"
        storage-key="voxel-map:folder:map-config"
      >
        <map-config-panel .editing=${editing}></map-config-panel>
      </jolly-folder>
    `;
  }

  #renderMaterials(
    editing: VoxelMapEditing
  ) {
    return html`
      ${this.showsBlockLibrary ? html`
        <jolly-folder
          flush
          key="material-block-library"
          label="Block Library"
          storage-key="voxel-map:folder:material-block-library"
        >
          <block-library
            .editing=${editing}
            .editable=${false}
            layout="compact"
          ></block-library>
        </jolly-folder>
      ` : nothing}
      <material-library .editing=${editing}></material-library>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "materials-panel": MaterialsPanel;
  }
}
