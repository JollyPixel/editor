export interface FacadeOwner {
  release(
    child: FacadeItem
  ): void;
}

// CONSTANTS
const kOwners = new WeakMap<object, FacadeOwner>();

export function adoptFacadeItem(
  child: FacadeItem,
  owner: FacadeOwner
): void {
  kOwners.set(child, owner);
}

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
    kOwners.get(this)?.release(this);
    kOwners.delete(this);
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
