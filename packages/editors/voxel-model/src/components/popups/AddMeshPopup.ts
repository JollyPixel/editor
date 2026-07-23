// Import Third-party Dependencies
import { LitElement, css, html } from "lit";
import { property } from "lit/decorators.js";

export class AddMeshPopup extends LitElement {
  @property()
  declare public title: string;

  @property()
  declare public placeholder: string;

  @property()
  declare public onConfirm: ((name: string) => void) | null;

  @property()
  declare public onCancel: (() => void) | null;

  private inputValue: string = "";

  constructor(options?: {
    title?: string;
    placeholder?: string;
    onConfirm?: (name: string) => void;
    onCancel?: () => void;
  }) {
    super();
    this.title = options?.title || "Enter Name";
    this.placeholder = options?.placeholder || "Name...";
    this.onConfirm = options?.onConfirm || null;
    this.onCancel = options?.onCancel || null;
  }

  static override styles = css`
    :host {
      --popup-background: white;
      --popup-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 10px 13px rgba(0, 0, 0, 0.1);
      --popup-border-radius: 8px;
      --popup-text-color: #333;
      --popup-border-color: #ddd;
      --popup-primary-color: #4a90e2;
      --popup-primary-hover: #357abd;
    }

    .popup {
      background: var(--popup-background);
      border-radius: var(--popup-border-radius);
      box-shadow: var(--popup-shadow);
      padding: 24px;
      min-width: 300px;
      max-width: 500px;
      position: relative;
      z-index: 1001;
    }

    .popup h2 {
      margin: 0 0 12px 0;
      font-size: 1.25em;
      color: var(--popup-text-color);
    }

    .popup input {
      width: 100%;
      padding: 8px 12px;
      margin-bottom: 16px;
      border: 1px solid var(--popup-border-color);
      border-radius: 4px;
      font-size: 1em;
      box-sizing: border-box;
      font-family: inherit;
    }

    .popup input:focus {
      outline: none;
      border-color: var(--popup-primary-color);
      box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
    }

    .buttons {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    button {
      padding: 8px 16px;
      border: 1px solid var(--popup-border-color);
      border-radius: 4px;
      background: var(--popup-background);
      color: var(--popup-text-color);
      cursor: pointer;
      font-size: 0.95em;
      transition: all 0.2s;
      font-family: inherit;
    }

    button:hover {
      background: #f5f5f5;
    }

    button.primary {
      background: var(--popup-primary-color);
      color: white;
      border-color: var(--popup-primary-hover);
    }

    button.primary:hover {
      background: var(--popup-primary-hover);
    }
  `;

  override render() {
    return html`
      <div class="popup">
        <h2>${this.title}</h2>
        <input
          type="text"
          placeholder="${this.placeholder}"
          @input="${this.handleInput}"
          @keydown="${this.handleKeyDown}"
          autofocus
        />
        <div class="buttons">
          <button @click="${this.handleCancel}">Cancel</button>
          <button class="primary" @click="${this.handleConfirm}">OK</button>
        </div>
      </div>
    `;
  }

  override firstUpdated() {
    const input = this.renderRoot.querySelector("input") as HTMLInputElement;
    if (input) {
      setTimeout(() => input.focus(), 100);
    }
  }

  private handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    this.inputValue = target.value;
  };

  private handleConfirm = () => {
    if (this.onConfirm) {
      this.onConfirm(this.inputValue);
    }
    const event = new CustomEvent("confirm", {
      detail: { name: this.inputValue },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  };

  private handleCancel = () => {
    if (this.onCancel) {
      this.onCancel();
    }
    const event = new CustomEvent("cancel", {
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      this.handleConfirm();
    }
    else if (e.key === "Escape") {
      e.preventDefault();
      this.handleCancel();
    }
  };
}

if (!customElements.get("jolly-add-mesh-popup")) {
  customElements.define("jolly-add-mesh-popup", AddMeshPopup);
}
