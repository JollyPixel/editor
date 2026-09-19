// Import Third-party Dependencies
import { Dialog } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  appendConfirmActions,
  checkboxField,
  settlePrompt
} from "./dialogFields.ts";

export interface DeleteResult {
  deleteChildren: boolean;
}

export interface PromptDeleteOptions {
  heading: string;
  hasChildren: boolean;
}

export function promptDelete(
  options: PromptDeleteOptions
): Promise<DeleteResult | null> {
  const { heading, hasChildren } = options;
  const dialog = new Dialog();
  dialog.heading = heading;

  let deleteChildren = true;
  if (hasChildren) {
    dialog.append(checkboxField("Delete children too", true, (value) => {
      deleteChildren = value;
    }));
  }

  const { cancel } = appendConfirmActions(dialog, "Delete", "danger");

  return settlePrompt(dialog, resolveResult, cancel);

  function resolveResult(
    returnValue: string
  ): DeleteResult | null {
    if (returnValue !== "confirm") {
      return null;
    }

    return { deleteChildren: hasChildren && deleteChildren };
  }
}
