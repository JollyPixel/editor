// Import Internal Dependencies
import "../controls/Separator.ts";

export class Separator {
  readonly element: HTMLElement;

  constructor() {
    this.element = document.createElement(
      "jolly-separator"
    );
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
    return this.element.hasAttribute("disabled");
  }

  set disabled(
    value: boolean
  ) {
    this.element.toggleAttribute("disabled", value);
  }

  dispose(): void {
    this.element.remove();
  }
}
