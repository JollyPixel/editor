// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("prompt-dialog")
export class PromptDialog extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }

    .dialog {
      background: #1e2428;
      border: 1px solid #2d3a40;
      border-radius: 4px;
      padding: 16px;
      min-width: 280px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    label {
      font-size: 12px;
      color: #c8d4da;
      font-family: sans-serif;
    }

    input {
      background: #111a20;
      border: 1px solid #333;
      color: #eee;
      font-size: 13px;
      padding: 6px 8px;
      border-radius: 3px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }

    input:focus {
      border-color: #4488ff;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 4px;
    }

    button {
      border: none;
      border-radius: 3px;
      padding: 5px 12px;
      font-size: 12px;
      cursor: pointer;
      color: #eee;
      font-family: sans-serif;
    }

    .cancel {
      background: #2d3a40;
    }

    .confirm {
      background: #4488ff;
    }
  `;

  @property({ type: String })
  declare label: string;

  @property({ type: String })
  declare defaultValue: string;

  override firstUpdated() {
    const input = this.shadowRoot?.querySelector("input");
    if (input) {
      input.select();
      input.focus();
    }
  }

  #onKeydown(
    event: KeyboardEvent
  ) {
    if (event.key === "Enter") {
      this.#confirm();
    }
    else if (event.key === "Escape") {
      this.#cancel();
    }
  }

  #confirm() {
    const input = this.shadowRoot?.querySelector("input");
    const value = input?.value.trim() ?? "";

    this.dispatchEvent(new CustomEvent<string>("prompt-confirm", {
      detail: value,
      bubbles: false,
      composed: false
    }));
  }

  #cancel() {
    this.dispatchEvent(new CustomEvent("prompt-cancel", {
      bubbles: false,
      composed: false
    }));
  }

  override render() {
    return html`
      <div class="overlay" @click=${this.#cancel}>
        <div class="dialog" @click=${(event: Event) => event.stopPropagation()}>
          <label>${this.label}</label>
          <input
            type="text"
            .value=${this.defaultValue}
            @keydown=${this.#onKeydown}
          />
          <div class="actions">
            <button class="cancel" @click=${this.#cancel}>Cancel</button>
            <button class="confirm" @click=${this.#confirm}>Confirm</button>
          </div>
        </div>
      </div>
    `;
  }
}

export function showPrompt(
  options: { label: string; defaultValue?: string; }
): Promise<string | null> {
  const dialog = document.createElement("prompt-dialog");
  dialog.label = options.label;
  dialog.defaultValue = options.defaultValue ?? "";
  document.body.appendChild(dialog);

  const { promise, resolve } = Promise.withResolvers<string | null>();

  dialog.addEventListener("prompt-confirm", (event) => {
    resolve((event as CustomEvent<string>).detail);
    dialog.remove();
  }, { once: true });

  dialog.addEventListener("prompt-cancel", () => {
    resolve(null);
    dialog.remove();
  }, { once: true });

  return promise;
}

declare global {
  interface HTMLElementTagNameMap {
    "prompt-dialog": PromptDialog;
  }
}
