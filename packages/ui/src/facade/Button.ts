// Import Internal Dependencies
import "../controls/Button.ts";
import { FacadeItem } from "./FacadeItem.ts";

export interface ButtonOptions {
  title?: string;
}

/**
 * A `jolly-button` with no bound value, matching `folder.addButton`.
 */
export class Button extends FacadeItem {
  readonly element: HTMLElement;

  #button: HTMLElementTagNameMap["jolly-button"];

  constructor(
    options: ButtonOptions = {}
  ) {
    super();
    this.#button = document.createElement("jolly-button");
    this.#button.textContent = options.title ?? "";
    this.element = this.#button;
  }

  on(
    name: "click",
    handler: (event: MouseEvent) => void
  ): this {
    this.#button.addEventListener(name, handler);

    return this;
  }

  protected override readDisabled(): boolean {
    return this.#button.disabled;
  }

  protected override writeDisabled(
    value: boolean
  ): void {
    this.#button.disabled = value;
  }
}
