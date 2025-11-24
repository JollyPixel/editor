// Import Third-party Dependencies
import { LitElement, css, html } from "lit";
// import { state, query } from "lit/decorators.js";

export class RightPanel extends LitElement {
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

  override render() {
    return html`
      <nav>
        <ul>
          <li><button>Add Cube</button></li>
          <li><button>Duplicate</button></li>
        </ul>
      </nav>
      <section>
      </section>
    `;
  }
}

customElements.define("jolly-model-editor-right-panel", RightPanel);
