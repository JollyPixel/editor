// Import Third-party Dependencies
import { html, css } from "lit";
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import "../../features/blocks/library/BlockLibrary.ts";
import "../../features/materials/MaterialEditor.ts";

@customElement("materials-panel")
export class MaterialsPanel extends WorkspaceElement {
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
  `;

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { mapDocument } = workspace;
    const refresh = (): void => {
      const pane = this.closest("jolly-pane");
      if (pane !== null) {
        pane.disabled = mapDocument.blocks.size === 0;
      }
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
      <material-editor .workspace=${workspace}></material-editor>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "materials-panel": MaterialsPanel;
  }
}
