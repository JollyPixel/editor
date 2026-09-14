// Import Third-party Dependencies
import { LitElement, css, html, type TemplateResult } from "lit";

// Import Internal Dependencies
import type ModelManager from "../../features/groups/ModelManager.ts";
import type { ModelSceneComponent } from "../ModelSceneComponent.ts";
import { BlockTreeController } from "./BlockTreeController.ts";
import "./blockIcons.ts";

export class RightPanel extends LitElement {
  #tree = new BlockTreeController(this);

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      font: inherit;
    }

    jolly-toolbar {
      padding: var(--jolly-space-2, 8px);
    }

    jolly-tree {
      flex: 1 1 auto;
      overflow: auto;
      padding-inline: var(--jolly-space-1, 4px);
    }
  `;

  public setModelManager(
    modelManager: ModelManager
  ): void {
    this.#tree.setModelManager(modelManager);
  }

  public setSceneManager(
    sceneManager: ModelSceneComponent
  ): void {
    this.#tree.setSceneManager(sceneManager);
  }

  override render(): TemplateResult {
    return html`
      <jolly-toolbar label="Actions">
        <jolly-tool-button
          icon="plus"
          label="Add Block"
          @click=${this.#tree.addBlock}
        ></jolly-tool-button>
        <jolly-tool-button
          icon="block-duplicate"
          label="Duplicate"
          ?disabled=${!this.#tree.hasSelection}
          @click=${this.#tree.duplicateSelected}
        ></jolly-tool-button>
        <jolly-tool-button
          icon="block-delete"
          label="Delete"
          ?disabled=${!this.#tree.hasSelection}
          @click=${this.#tree.deleteSelected}
        ></jolly-tool-button>
      </jolly-toolbar>
      <jolly-tree
        .nodes=${this.#tree.nodes}
        .selected=${this.#tree.selected}
        .expanded=${this.#tree.expanded}
        reorderable
        row-drag
        renamable
        @jolly-select=${this.#tree.handleSelect}
        @jolly-toggle-expand=${this.#tree.handleToggleExpand}
        @jolly-rename=${this.#tree.handleRename}
        @jolly-reparent=${this.#tree.handleReparent}
      ></jolly-tree>
    `;
  }
}

customElements.define("jolly-model-editor-right-panel", RightPanel);
