// Import Third-party Dependencies
import {
  LitElement,
  html,
  css,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  PopoverController,
  detailOf,
  type JollyChangeDetail
} from "../../../../src/index.ts";

// CONSTANTS
const kTag = "gallery-brush-swatch";

export const COLOR_POPOVER_EXAMPLE: GalleryExample = {
  id: "scenarios/color-popover",
  title: "Picker in a popup",
  render(host) {
    define();

    const root = document.createElement("div");
    root.className = "scenario-grid";

    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent =
      "Swatch, popup and picker with no jolly-color row. The same PopoverController " +
      "an editor uses for a brush colour.";

    // A nested scope would reset color-scheme to the system preference.
    root.append(
      hint,
      document.createElement(kTag)
    );
    host.append(root);
  }
};

function define(): void {
  if (customElements.get(kTag) !== undefined) {
    return;
  }

  class BrushSwatch extends LitElement {
    static override styles = css`
      .trigger {
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: var(--jolly-radius-sm, 2px);
        background: var(--jolly-brush-color, #000);
        cursor: pointer;
      }

      .popup {
        position: fixed;
        inset: auto;
        width: max-content;
        margin: 0;
        padding: var(--jolly-space-1, 4px);
        border: none;
        border-radius: var(--jolly-radius-md, 6px);
        background: var(--jolly-surface-raised, Canvas);
        box-shadow: var(--jolly-shadow-overlay);
      }

      code {
        display: block;
        margin-top: var(--jolly-space-1, 4px);
        color: var(--jolly-text-muted);
        font-size: 0.8em;
        letter-spacing: 0.06em;
      }
    `;

    static override properties = {
      value: {
        type: String
      }
    };

    declare value: string;

    #popup = new PopoverController(this, {
      anchor: () => this.renderRoot.querySelector(".trigger"),
      popover: () => this.renderRoot.querySelector(".popup")
    });

    constructor() {
      super();

      this.value = "#4488ff";
    }

    #onChange(
      event: Event
    ): void {
      const detail = detailOf<JollyChangeDetail<string>>(event);
      if (detail !== null) {
        this.value = detail.value;
      }
    }

    override render(): TemplateResult {
      return html`
        <button
          class="trigger"
          type="button"
          popovertarget="brush"
          aria-label="Brush colour"
          aria-haspopup="dialog"
          aria-expanded=${this.#popup.open}
          style="--jolly-brush-color:${this.value}"
        ></button>
        <div
          class="popup"
          id="brush"
          popover
          @beforetoggle=${this.#popup.onBeforeToggle}
          @toggle=${this.#popup.onToggle}
        >
          <jolly-color-picker
            .value=${this.value}
            alpha
            @jolly-input=${this.#onChange}
            @jolly-change=${this.#onChange}
          ></jolly-color-picker>
        </div>
        <code data-readout="brush">${this.value}</code>
      `;
    }
  }

  customElements.define(kTag, BrushSwatch);
}
