export abstract class FacadeItem<
  TElement extends HTMLElement = HTMLElement
> {
  abstract readonly element: TElement;

  get hidden(): boolean {
    return Boolean(this.element.hidden);
  }

  set hidden(
    value: boolean
  ) {
    this.element.hidden = value;
  }

  get disabled(): boolean {
    return this.readDisabled();
  }

  set disabled(
    value: boolean
  ) {
    this.writeDisabled(value);
  }

  dispose(): void {
    this.element.remove();
  }

  protected readDisabled(): boolean {
    return this.element.hasAttribute("disabled");
  }

  protected writeDisabled(
    value: boolean
  ): void {
    this.element.toggleAttribute("disabled", value);
  }
}
