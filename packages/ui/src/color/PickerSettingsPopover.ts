// Import Third-party Dependencies
import {
  html,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import {
  createRef,
  ref
} from "lit/directives/ref.js";

// Import Internal Dependencies
import { PopoverController } from "../field/PopoverController.ts";
import "../icon/Icon.ts";

export class PickerSettingsPopover {
  readonly #host: ReactiveControllerHost;
  readonly #content: () => TemplateResult;
  readonly #toggleButton = createRef<HTMLButtonElement>();
  readonly #panel = createRef<HTMLElement>();
  readonly #popup: PopoverController;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    content: () => TemplateResult
  ) {
    this.#host = host;
    this.#content = content;
    this.#popup = new PopoverController(host, {
      anchor: () => this.#toggleButton.value ?? null,
      popover: () => this.#panel.value ?? null,
      side: "above",
      align: "end"
    });
  }

  renderToggle(): TemplateResult {
    return html`
      <button
        ${ref(this.#toggleButton)}
        class="settings-toggle"
        type="button"
        title="Picker settings"
        aria-label="Picker settings"
        aria-haspopup="dialog"
        aria-expanded=${String(this.#popup.open)}
        @click=${this.#toggle}
      ><jolly-icon name="settings"></jolly-icon></button>
    `;
  }

  render(): TemplateResult {
    return html`
      <div
        ${ref(this.#panel)}
        class="settings-popover overlay-motion"
        popover
        role="dialog"
        aria-label="Picker settings"
        @beforetoggle=${this.#popup.onBeforeToggle}
        @toggle=${(event: ToggleEvent) => {
          this.#popup.onToggle(event);
          this.#host.requestUpdate();
        }}
      >${this.#content()}</div>
    `;
  }

  readonly #toggle = (): void => {
    if (this.#popup.open) {
      this.#popup.hide();
    }
    else {
      this.#popup.show();
    }
  };
}
