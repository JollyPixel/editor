// Import Third-party Dependencies
import { LitElement, css, html } from "lit";
import { TreeView } from "@jolly-pixel/fs-tree/tree-view";

// Import Internal Dependencies
import type ModelManager from "../three/ModelManager.js";
import type GroupManager from "../three/GroupManager.js";
import type { PopupManager } from "./PopupManager.js";
import { AddMeshPopup } from "./popups/index.js";

export class RightPanel extends LitElement {
  private treeView: TreeView;
  private modelManager: ModelManager | null = null;
  private popupManager: PopupManager | null = null;
  private uuidToListItemMap: Map<string, HTMLLIElement> = new Map();

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 300px;
      min-width: 200px;
      flex-shrink: 0;
      border-left: 2px solid var(--jolly-border-color);
      box-sizing: border-box;
      background: purple;
    }
    nav {
      width: 100%;
      padding: 5px;
      box-sizing: border-box;
    }

    ul {
      flex-grow: 1;
      height: 40px;
      margin: 0;
      padding: 0;
      display: flex;

      box-sizing: border-box;
      border: 2px solid var(--jolly-border-color);
      border-radius: 5px;

      list-style: none;
      background: var(--jolly-surface-color);
      gap: 5px;
    }
    ul > li {
      flex: 1;
      display: flex;
    }

    ul > li > button {
      flex-grow: 1;
      background: green;
      border: none;
      cursor: pointer;
      font-size: 1em;
      padding: 0;
      margin: 0;
      color: var(--jolly-text-color);
    }
    section {
      flex-grow: 1;
      width: 100%;
      box-sizing: border-box;
      border-bottom: 2px solid var(--jolly-border-color);
    }

    section {
      background: orange;
    }

    ol.tree {
      position: absolute;
      list-style: none;
      line-height: 1.5;
      margin: 0;
      padding: 0.25em 0.25em 2em 0.25em;
      width: 100%;
      min-height: 100%;
    }

    ol.tree * {
      user-select: none;
    }

    ol.tree.drop-inside:before {
      position: absolute;
      content: "";
      border-top: 1px solid #888;
      left: 0.25em;
      right: 0.25em;
      top: 0.25em;
    }

    ol.tree ol {
      list-style: none;
      margin: 0;
      padding-left: 24px;
    }

    ol.tree ol:last-of-type.drop-below {
      border-bottom: 1px solid #888;
      padding-bottom: 0;
    }

    ol.tree li.item,
    ol.tree li.group {
      background-clip: border-box;
      height: 28px;
      display: flex;
      padding: 1px;
      cursor: default;
      display: flex;
      align-items: center;
    }

    ol.tree li.item>.icon,
    ol.tree li.group>.icon,
    ol.tree li.item>.toggle,
    ol.tree li.group>.toggle {
      margin: -1px;
      width: 24px;
      height: 24px;
    }

    ol.tree li.item span,
    ol.tree li.group span {
      align-self: center;
      padding: 0.25em;
    }

    ol.tree li.item:hover,
    ol.tree li.group:hover {
      background-color: #eee;
    }

    ol.tree li.item.drop-above,
    ol.tree li.group.drop-above {
      border-top: 1px solid #888;
      padding-top: 0;
    }

    ol.tree li.item.drop-inside,
    ol.tree li.group.drop-inside {
      border: 1px solid #888;
      padding: 0;
    }

    ol.tree li.item.selected,
    ol.tree li.group.selected {
      background: #beddf4;
    }

    ol.tree li.item>.icon {
      background-image: url("./icons/item.svg");
    }

    ol.tree li.item.drop-below {
      border-bottom: 1px solid #888;
      padding-bottom: 0;
    }

    ol.tree li.group {
      color: #444;
    }

    ol.tree li.group>.toggle {
      background-image: url("./icons/group-open.svg");
      cursor: pointer;
    }

    ol.tree li.group.drop-below+ol {
      border-bottom: 1px solid #888;
    }

    ol.tree li.group.drop-below+ol:empty {
      margin-top: -1px;
      pointer-events: none;
    }

    ol.tree li.group.collapsed>.toggle {
      background-image: url("./icons/group-closed.svg");
    }

    ol.tree li.group.collapsed+ol>ol,
    ol.tree li.group.collapsed+ol>li {
      display: none;
    }
  `;

  override firstUpdated() {
    this.initTreeView();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    document.addEventListener("groupCreated", (e: Event) => {
      const event = e as CustomEvent;
      const { group, name } = event.detail;
      this.addGroupItemToUI(group, name || "Cube");
    });

    document.addEventListener("groupSelected", (e: Event) => {
      const event = e as CustomEvent;
      const { group } = event.detail;
      const uuid = group ? group.getGroupUUID() : null;
      this.setSelectedItemInUI(uuid);
    });

    // Listen to TreeView selection changes
    this.treeView.addEventListener("selectionChange", () => {
      this.handleTreeViewSelectionChange();
    });
  }

  private handleTreeViewSelectionChange(): void {
    const selectedNodes = this.treeView.selector.nodes;

    if (selectedNodes.length === 0) {
      if (this.modelManager) {
        this.modelManager.selectGroup(null);
      }

      return;
    }

    const selectedElement = selectedNodes[0] as HTMLLIElement;
    const uuid = selectedElement.getAttribute("data-uuid");

    if (!uuid || !this.modelManager) {
      return;
    }

    const group = this.modelManager.getGroupByUUID(uuid);
    if (group) {
      this.modelManager.selectGroup(group);
    }
  }

  private initTreeView() {
    const treeViewContainer = this.shadowRoot?.querySelector("section") as HTMLDivElement;
    this.treeView = new TreeView(treeViewContainer);
  }

  public setModelManager(modelManager: ModelManager): void {
    this.modelManager = modelManager;
  }

  public setPopupManager(popupManager: PopupManager): void {
    this.popupManager = popupManager;
  }

  public addGroupItemToUI(group: GroupManager, label: string = "Cube"): void {
    const uuid = group.getGroupUUID();
    const itemElt = document.createElement("li");
    itemElt.setAttribute("data-uuid", uuid);
    itemElt.classList.add("item");

    const iconElt = document.createElement("i");
    iconElt.classList.add("icon");
    itemElt.appendChild(iconElt);

    const spanElt = document.createElement("span");
    spanElt.textContent = label;
    itemElt.appendChild(spanElt);

    this.treeView.append(itemElt, "group");
    this.uuidToListItemMap.set(uuid, itemElt);
  }

  public setSelectedItemInUI(uuid: string | null): void {
    const selectedItem = uuid ? this.uuidToListItemMap.get(uuid) : null;

    // Update TreeView selector to keep it in sync
    this.treeView.selector.clear();
    if (selectedItem) {
      this.treeView.selector.add(selectedItem);
    }
  }

  private handleAddCube(): void {
    if (!this.popupManager) {
      return;
    }

    const addMeshPopup = new AddMeshPopup({
      title: "New Cube",
      placeholder: "Cube",
      onConfirm: (name) => {
        this.createCubeWithName(name || "Cube");
        this.popupManager?.hide();
      },
      onCancel: () => {
        this.popupManager?.hide();
      }
    });

    this.popupManager.show(addMeshPopup);
  }

  private createCubeWithName(name: string): void {
    const event = new CustomEvent("addcube", {
      detail: { name },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  override render() {
    return html`
      <nav>
        <ul>
          <li><button @click="${this.handleAddCube}">Add Cube</button></li>
          <li><button>Duplicate</button></li>
        </ul>
      </nav>
      <section>
      </section>
    `;
  }
}

customElements.define("jolly-model-editor-right-panel", RightPanel);
