// Import Third-party Dependencies
import { Dialog } from "@jolly-pixel/ui";
import type { MirrorAxes } from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import {
  appendConfirmActions,
  checkboxField,
  settlePrompt
} from "./dialogFields.ts";

export interface DuplicateResult {
  includeChildren: boolean;
  mirrorAxes: MirrorAxes;
}

export interface PromptDuplicateOptions {
  hasChildren: boolean;
}

export function promptDuplicate(
  options: PromptDuplicateOptions
): Promise<DuplicateResult | null> {
  const { hasChildren } = options;
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
  mirrorRow.append(
    ...(["x", "y", "z"] as const).map((axis) => checkboxField(axis.toUpperCase(), false, (value) => {
      mirrorAxes[axis] = value;
    }))
  );
  dialog.append(mirrorRow);

  const { confirm } = appendConfirmActions(dialog, "Duplicate", "accent");

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
