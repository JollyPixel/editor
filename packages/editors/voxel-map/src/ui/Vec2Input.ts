// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

// Import Internal Dependencies
import type { EventInput } from "./types.ts";

export interface Vec2 {
  x: number;
  y: number;
}

@customElement("vec2-input")
export class Vec2Input extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      gap: 4px;
    }

    .axis {
      display: flex;
      flex: 1;
      min-width: 0;
    }

    .axis-label {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      min-width: 16px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      border-radius: 2px 0 0 2px;
      user-select: none;
    }
    .axis-label.first { background: #9b2020; }
    .axis-label.second { background: #1e7a3a; }

    input {
      flex: 1;
      min-width: 0;
      width: 100%;
      background: #111a20;
      border: 1px solid #333;
      border-left: none;
      color: #eee;
      padding: 2px 4px;
      border-radius: 0 3px 3px 0;
      font-size: 12px;
    }
    input:focus {
      outline: none;
      border-color: #4488ff;
    }
  `;

  @property({ type: Number }) declare x: number;
  @property({ type: Number }) declare y: number;
  @property({ type: String }) declare labelX: string;
  @property({ type: String }) declare labelY: string;

  constructor() {
    super();

    this.x = 0;
    this.y = 0;
    this.labelX = "X";
    this.labelY = "Y";
  }

  override render() {
    return html`
      ${this.#renderAxis("x", this.x, this.labelX, "first")}
      ${this.#renderAxis("y", this.y, this.labelY, "second")}
    `;
  }

  // eslint-disable-next-line max-params
  #renderAxis(
    axis: "x" | "y",
    value: number,
    label: string,
    colorClass: "first" | "second"
  ) {
    return html`
      <div class="axis">
        <span class="axis-label ${colorClass}">${label}</span>
        <input
          type="number"
          .value=${String(value)}
          @change=${(event: EventInput) => this.#onChange(axis, event)}
        />
      </div>
    `;
  }

  #onChange(
    axis: "x" | "y",
    event: EventInput
  ): void {
    const val = parseInt(event.target.value, 10);
    if (Number.isNaN(val)) {
      return;
    }

    this.dispatchEvent(new CustomEvent<Vec2>("change", {
      detail: {
        x: axis === "x" ? val : this.x,
        y: axis === "y" ? val : this.y
      },
      bubbles: false,
      composed: false
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "vec2-input": Vec2Input;
  }
}
