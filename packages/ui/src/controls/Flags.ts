// Import Third-party Dependencies
import {
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { JollyField } from "../field/JollyField.ts";
import { flagsStyles } from "./Flags.styles.ts";
import {
  hasFlag,
  setFlag
} from "./flagMask.ts";
import { isInputElement } from "../dom.ts";
import type { JollyOption } from "./types.ts";

export interface FlagsDefaults {
  /**
   * Empty flags use a zero mask.
   */
  value: number;
}

/**
 * Edits a bitmask as independent checkboxes.
 */
@customElement("jolly-flags")
export class Flags extends JollyField<number> {
  static readonly Defaults: FlagsDefaults = {
    value: 0
  };

  static override styles = [
    ...JollyField.styles,
    flagsStyles
  ];

  @property({ attribute: false })
  declare options: JollyOption<number>[];

  constructor() {
    super();

    this.options = [];
    this.value = Flags.Defaults.value;
  }

  protected renderValue(): TemplateResult {
    const mask = this.concreteValue;

    return html`
      <div class="flags" role="group" aria-label=${this.label}>
        ${this.options.map((option) => this.#renderFlag(option, mask))}
      </div>
    `;
  }

  #renderFlag(
    option: JollyOption<number>,
    mask: number | undefined
  ): TemplateResult {
    return html`
      <label class="flag">
        <input
          type="checkbox"
          .checked=${mask === undefined ? false : hasFlag(mask, option.value)}
          .indeterminate=${mask === undefined}
          ?disabled=${this.disabled || option.disabled === true}
          aria-readonly=${this.readonlyAria}
          aria-disabled=${this.lockedAria}
          aria-description=${this.lockDescription}
          @click=${(event: MouseEvent) => this.#onToggle(option, event)}
        >
        <span>${option.label}</span>
      </label>
    `;
  }

  #onToggle(
    option: JollyOption<number>,
    event: MouseEvent
  ): void {
    if (!isInputElement(event.target)) {
      return;
    }

    if (!this.editable) {
      // Preserve tab order for locked fields.
      event.preventDefault();

      return;
    }

    const mask = this.concreteValue;
    // A mixed value resolves to the clicked bit.
    if (mask === undefined) {
      this.emitChange(option.value);

      return;
    }

    /*
     * Native activation has already updated `checked` before this handler runs.
     */
    this.emitChange(
      setFlag(
        mask,
        option.value,
        event.target.checked
      )
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-flags": Flags;
  }
}
