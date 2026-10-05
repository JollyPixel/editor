// Import Internal Dependencies
import "../controls/PropertyRow.ts";
import { FacadeItem } from "./FacadeItem.ts";
import type {
  FieldAlign,
  FieldDescriptionDisplay
} from "../field/JollyField.ts";
import {
  applyFieldLayout,
  type FieldLayoutOptions
} from "./fieldLayout.ts";

export interface NoteOptions extends FieldLayoutOptions {
  label?: string;
  description?: string;
  descriptionDisplay?: FieldDescriptionDisplay;
  align?: FieldAlign;
}

export class FacadeNote extends FacadeItem<
  HTMLElementTagNameMap["jolly-property-row"]
> {
  readonly element: HTMLElementTagNameMap["jolly-property-row"];

  constructor(
    options: NoteOptions = {}
  ) {
    super();

    this.element = document.createElement("jolly-property-row");
    this.element.label = options.label ?? "";
    this.element.description = options.description ?? "";
    if (options.align !== undefined) {
      this.element.align = options.align;
    }
    if (options.descriptionDisplay !== undefined) {
      this.element.descriptionDisplay = options.descriptionDisplay;
    }
    applyFieldLayout(this.element, options);
  }

  get label(): string {
    return this.element.label;
  }

  set label(
    value: string
  ) {
    this.element.label = value;
  }

  get description(): string {
    return this.element.description;
  }

  set description(
    value: string
  ) {
    this.element.description = value;
  }
}
