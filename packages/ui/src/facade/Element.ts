// Import Internal Dependencies
import { FacadeItem } from "./FacadeItem.ts";

export class FacadeElement<
  TElement extends HTMLElement = HTMLElement
> extends FacadeItem<TElement> {
  readonly element: TElement;

  constructor(
    element: TElement
  ) {
    super();
    this.element = element;
  }
}
