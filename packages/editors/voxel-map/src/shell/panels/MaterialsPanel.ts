// Import Third-party Dependencies
import { html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { hintStyles } from "../../shared/styles/hint.styles.ts";
import "../../features/blocks/library/BlockLibrary.ts";
import "../../features/materials/MaterialLibrary.ts";
import "./MapConfigPanel.ts";

@customElement("materials-panel")
export class MaterialsPanel extends WorkspaceElement {
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

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { mapDocument } = workspace;
    const refresh = (): void => {
      this._hasBlocks = mapDocument.blocks.size > 0;
    };
    refresh();

    return [
      mapDocument.subscribe("blockRegistryChanged", refresh),
      mapDocument.subscribe("reset", refresh)
    ];
  }

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return html``;
    }

    return html`
      ${this._hasBlocks ?
        this.#renderMaterials(workspace) :
        html`<p class="hint">Add a block to the map to edit materials.</p>`}
      <jolly-folder
        key="map-config"
        label="View"
        storage-key="voxel-map:folder:map-config"
      >
        <map-config-panel .workspace=${workspace}></map-config-panel>
      </jolly-folder>
    `;
  }

  #renderMaterials(
    workspace: VoxelMapWorkspace
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
            .workspace=${workspace}
            .editable=${false}
            layout="compact"
          ></block-library>
        </jolly-folder>
      ` : nothing}
      <material-library .workspace=${workspace}></material-library>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "materials-panel": MaterialsPanel;
  }
}
