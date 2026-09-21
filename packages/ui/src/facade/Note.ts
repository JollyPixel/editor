// Import Internal Dependencies
import "../controls/PropertyRow.ts";
import { FacadeItem } from "./FacadeItem.ts";
import type {
  FieldAlign,
  FieldLabelPosition
} from "../field/JollyField.ts";

export interface NoteOptions {
  label?: string;
  description?: string;
  align?: FieldAlign;
  labelPosition?: FieldLabelPosition;
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
    if (options.labelPosition !== undefined) {
      this.element.labelPosition = options.labelPosition;
    }
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
