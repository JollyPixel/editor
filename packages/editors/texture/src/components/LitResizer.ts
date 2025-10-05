// Import Third-party Dependencies
import { LitElement, css } from "lit";
import { property } from "lit/decorators.js";

export type ModeResizer = "horizontal" | "vertical";

export class Resizer extends LitElement {
  @property({ type: String })
  declare name: string;

  @property({ type: String })
  declare mode: ModeResizer;

  static override styles = css`
    :host {
      width: 5px;
      background: red;
      flex-basis: 5px;
      flex-shrink: 0;
    }
  `;

  constructor() {
    super();

    this.name = "resizer";
    this.mode = "horizontal";

    this.style.cursor = this.mode === "horizontal" ? "col-resize" : "row-resize";

    this.addEventListener("pointerdown", this.startDrag.bind(this));
  }

  startDrag(e: PointerEvent) {
    this.setPointerCapture(e.pointerId);
    let start = this.mode === "horizontal" ? e.clientX : e.clientY;
    const onMove = (moveEvent: PointerEvent) => {
      const delta = this.mode === "horizontal" ? moveEvent.clientX - start : moveEvent.clientY - start;
      start = this.mode === "horizontal" ? moveEvent.clientX : moveEvent.clientY;

      this.dispatchEvent(new CustomEvent("resizer", {
        detail: { delta, name: this.name },
        bubbles: true,
        composed: true
      }));
    };

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
}

customElements.define("jolly-resizer", Resizer);
