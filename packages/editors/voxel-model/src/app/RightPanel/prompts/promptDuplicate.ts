// Import Third-party Dependencies
import { Dialog } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { actionButton, checkboxField, settlePrompt } from "./dialogPromptHelpers.ts";
import type { MirrorAxes } from "../../../features/groups/mirrorTransform.ts";

export interface DuplicateResult {
  includeChildren: boolean;
  mirrorAxes: MirrorAxes;
}

export interface PromptDuplicateOptions {
  hasChildren: boolean;
}

export function promptDuplicate(
  { hasChildren }: PromptDuplicateOptions
): Promise<DuplicateResult | null> {
  const dialog = new Dialog();
  dialog.heading = "Duplicate";

  let includeChildren = true;
  if (hasChildren) {
    dialog.append(checkboxField("Duplicate children too", true, (value) => {
      includeChildren = value;
    }));
  }

  const mirrorAxes: MirrorAxes = { x: false, y: false, z: false };
  const mirrorTitle = document.createElement("div");
  mirrorTitle.textContent = "Mirror axis";
  mirrorTitle.style.fontSize = "0.85em";
  mirrorTitle.style.color = "var(--jolly-text-muted)";
  dialog.append(mirrorTitle);

  const mirrorRow = document.createElement("div");
  mirrorRow.style.display = "flex";
  mirrorRow.style.gap = "var(--jolly-space-4, 16px)";
  dialog.append(mirrorRow);

  mirrorRow.append(
    checkboxField("X", false, (value) => {
      mirrorAxes.x = value;
    }),
    checkboxField("Y", false, (value) => {
      mirrorAxes.y = value;
    }),
    checkboxField("Z", false, (value) => {
      mirrorAxes.z = value;
    })
  );

  const confirm = actionButton("Duplicate", "confirm", "accent");
  const cancel = actionButton("Cancel", "cancel", "default");
  confirm.addEventListener("click", () => dialog.close("confirm"));
  cancel.addEventListener("click", () => dialog.close("cancel"));
  dialog.append(cancel, confirm);
  document.body.append(dialog);

  return settlePrompt(dialog, resolveResult, confirm);

  function resolveResult(
    returnValue: string
  ): DuplicateResult | null {
    if (returnValue !== "confirm") {
      return null;
    }

    return {
      includeChildren: hasChildren && includeChildren,
      mirrorAxes
    };
  }
}
