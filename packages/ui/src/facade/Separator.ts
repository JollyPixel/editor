// Import Internal Dependencies
import "../controls/Separator.ts";
import { FacadeItem } from "./FacadeItem.ts";

export class Separator extends FacadeItem {
  readonly element: HTMLElement;

  constructor() {
    super();
    this.element = document.createElement(
      "jolly-separator"
    );
  }
}
