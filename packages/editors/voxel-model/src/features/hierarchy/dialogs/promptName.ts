// Import Third-party Dependencies
import {
  Dialog,
  Text,
  detailOf,
  type JollyChangeDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  appendConfirmActions,
  checkboxField,
  settlePrompt
} from "./dialogFields.ts";

export interface PromptNameResult {
  name: string;
  addAsChild: boolean;
}

export interface PromptNameOptions {
  heading: string;
  fieldLabel: string;
  defaultName: string;
  offerAddAsChild: boolean;
}

export function promptName(
  options: PromptNameOptions
): Promise<PromptNameResult | null> {
  const { heading, fieldLabel, defaultName, offerAddAsChild } = options;
  const dialog = new Dialog();
  dialog.heading = heading;

  let name = defaultName;
  const nameField = new Text();
  nameField.label = fieldLabel;
  nameField.value = name;
  nameField.addEventListener("jolly-input", captureName);
  nameField.addEventListener("jolly-change", captureName);
  dialog.append(nameField);

  let addAsChild = true;
  if (offerAddAsChild) {
    dialog.append(checkboxField("Add as child of selection", true, (value) => {
      addAsChild = value;
    }));
  }

  appendConfirmActions(dialog, "OK", "accent");

  return settlePrompt(dialog, resolveResult, nameField);

  function captureName(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<string>>(event);
    if (detail !== null) {
      name = detail.value;
    }
  }

  function resolveResult(
    returnValue: string
  ): PromptNameResult | null {
    if (returnValue !== "confirm") {
      return null;
    }

    return {
      name: name.trim(),
      addAsChild: offerAddAsChild && addAsChild
    };
  }
}
