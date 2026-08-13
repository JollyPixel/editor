// Import Internal Dependencies
import "../controls/Button.ts";

export interface ButtonOptions {
  title?: string;
}

/**
 * A `jolly-button` with no bound value, matching `folder.addButton`.
 */
export class Button {
  readonly element: HTMLElement;

  #button: HTMLElementTagNameMap["jolly-button"];

  constructor(
    options: ButtonOptions = {}
  ) {
    this.#button = document.createElement("jolly-button");
    this.#button.textContent = options.title ?? "";
    this.element = this.#button;
  }

  get hidden(): boolean {
    return Boolean(this.element.hidden);
  }

  set hidden(
    value: boolean
  ) {
    this.element.hidden = value;
  }

  get disabled(): boolean {
    return this.#button.disabled;
  }

  set disabled(
    value: boolean
  ) {
    this.#button.disabled = value;
  }

  on(
    name: "click",
    handler: (event: MouseEvent) => void
  ): this {
    this.#button.addEventListener(name, handler);

    return this;
  }

  dispose(): void {
    this.element.remove();
  }
}
