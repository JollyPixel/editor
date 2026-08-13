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
import type { ThemeMode } from "../types.ts";

// Registers jolly-button-group.
import "../../controls/ButtonGroup.ts";

// CONSTANTS
const kOptions: JollyOption<ThemeMode>[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" }
];

/**
 * A `jolly-button-group` pre-wired to `ThemeMode`, the toggle every gallery
 * and example page rebuilds by hand otherwise. Controlled, like every other
 * element: it emits `jolly-change` and leaves applying `theme` to a scope
 * host to the consumer.
 */
@customElement("jolly-theme-control")
export class ThemeControl extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }

    jolly-button-group {
      flex: 1 1 96px;
      min-width: 96px;
    }
  `;

  @property({ attribute: false })
  declare value: ThemeMode;

  @property({ type: String })
  declare label: string;

  constructor() {
    super();

    this.value = "auto";
    this.label = "Theme";
  }

  override render(): TemplateResult {
    return html`
      <jolly-button-group
        label=${this.label}
        .options=${kOptions}
        .value=${this.value}
        @jolly-change=${this.#onChange}
      ></jolly-button-group>
    `;
  }

  #onChange(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<ThemeMode>>(event);
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
    "jolly-theme-control": ThemeControl;
  }
}
