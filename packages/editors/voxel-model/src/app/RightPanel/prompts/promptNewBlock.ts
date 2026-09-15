// Import Third-party Dependencies
import {
  Checkbox,
  Dialog,
  Text,
  detailOf,
  type JollyChangeDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { actionButton, settlePrompt } from "./dialogPromptHelpers.ts";

export interface NewBlockResult {
  name: string;
  addAsChild: boolean;
}

export interface PromptNewBlockOptions {
  /** Whether a selection exists that the new block could be parented under. */
  offerAddAsChild: boolean;
}

export function promptNewBlock(
  { offerAddAsChild }: PromptNewBlockOptions
): Promise<NewBlockResult | null> {
  const dialog = new Dialog();
  dialog.heading = "New Block";

  let name = "Block";
  const nameField = new Text();
  nameField.label = "Block name";
  nameField.value = name;
  nameField.addEventListener("jolly-input", captureName);
  nameField.addEventListener("jolly-change", captureName);
  dialog.append(nameField);

  let addAsChild = true;
  if (offerAddAsChild) {
    const addAsChildField = new Checkbox();
    addAsChildField.label = "Add as child of selection";
    addAsChildField.value = true;
    addAsChildField.addEventListener("jolly-change", captureAddAsChild);
    dialog.append(addAsChildField);
  }

  const confirm = actionButton("OK", "confirm", "accent");
  const cancel = actionButton("Cancel", "cancel", "default");
  confirm.addEventListener("click", () => dialog.close("confirm"));
  cancel.addEventListener("click", () => dialog.close("cancel"));
  dialog.append(cancel, confirm);
  document.body.append(dialog);

  return settlePrompt(dialog, resolveResult, nameField);

  function captureName(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<string>>(event);
    if (detail !== null) {
      name = detail.value;
    }
  }

  function captureAddAsChild(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<boolean>>(event);
    if (detail !== null) {
      addAsChild = detail.value;
    }
  }

  function resolveResult(
    returnValue: string
  ): NewBlockResult | null {
    if (returnValue !== "confirm") {
      return null;
    }

    return {
      name: name.trim(),
      addAsChild: offerAddAsChild && addAsChild
    };
  }
}
