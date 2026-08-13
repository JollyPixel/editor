// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import {
  emitFieldEvent,
  type JollyChangeDetail
} from "../../field/events.ts";
import { detailOf } from "../../dom.ts";
import type { JollyOption } from "../../controls/types.ts";
import type { Density } from "../types.ts";

// Registers jolly-select.
import "../../controls/Select.ts";

// CONSTANTS
const kOptions: JollyOption<Density>[] = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "comfortable", label: "Comfortable" }
];

/**
 * A `jolly-select` pre-wired to `Density`, the toggle every gallery and
 * example page rebuilds by hand otherwise. Controlled, like every other
 * element: it emits `jolly-change` and leaves applying `density` to a scope
 * host to the consumer.
 */
@customElement("jolly-density-control")
export class DensityControl extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }

    jolly-select {
      flex: 1 1 96px;
      min-width: 96px;
    }
  `;

  @property({ attribute: false })
  declare value: Density;

  @property({ type: String })
  declare label: string;

  constructor() {
    super();

    this.value = "default";
    this.label = "Density";
  }

  override render(): TemplateResult {
    return html`
      <jolly-select
        label=${this.label}
        .options=${kOptions}
        .value=${this.value}
        @jolly-change=${this.#onChange}
      ></jolly-select>
    `;
  }

  #onChange(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<Density>>(event);
    if (detail === null) {
      return;
    }

    this.value = detail.value;
    emitFieldEvent(
      this,
      "jolly-change",
      detail.value
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-density-control": DensityControl;
  }
}
