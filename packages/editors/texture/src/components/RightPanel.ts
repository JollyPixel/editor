// Import Third-party Dependencies
import { LitElement, css, html } from "lit";
import { TreeView } from "@jolly-pixel/fs-tree/tree-view";

type ItemType = "item" | "group";

export class RightPanel extends LitElement {
  private treeView: TreeView;

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
  `;

  override firstUpdated() {
    this.initTreeView();
  }

  private initTreeView() {
    const treeViewContainer = this.shadowRoot?.querySelector("section") as HTMLDivElement;
    this.treeView = new TreeView(treeViewContainer);
  }
  private TreeViewCreateItem(label: string, type: ItemType): void {
    const itemElt = document.createElement("li");

    const iconElt = document.createElement("i");
    iconElt.classList.add("icon");
    itemElt.appendChild(iconElt);

    const spanElt = document.createElement("span");
    spanElt.textContent = label;
    itemElt.appendChild(spanElt);

    this.treeView.append(itemElt, type);
  }

  private handleAddCube(): void {
    const event = new CustomEvent("addcube", {
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);

    this.TreeViewCreateItem("Cube", "item");
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
