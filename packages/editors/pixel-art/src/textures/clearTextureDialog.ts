// Import Third-party Dependencies
import {
  Checkbox,
  onFieldChange,
  showChoice
} from "@jolly-pixel/ui";

// CONSTANTS
const kMessage = "Make the texture transparent? " +
  "Pixels inside UV slots are kept unless the option below is checked.";
const kNoRegionsMessage = "Clear the entire texture and make every pixel transparent?";

export interface ClearTextureDialogOptions {
  hasUVRegions: boolean;
}

export interface ClearTextureDialogResult {
  includeUV: boolean;
}

export async function showClearTextureDialog(
  options: ClearTextureDialogOptions
): Promise<ClearTextureDialogResult | null> {
  let includeUV = false;
  const content: Node[] = [];
  if (options.hasUVRegions) {
    const checkbox = new Checkbox();
    checkbox.label = "Also clear pixels inside UV slots";
    checkbox.value = false;
    onFieldChange<boolean>(checkbox, (value) => {
      includeUV = value;
    });
    content.push(checkbox);
  }

  const choice = await showChoice({
    title: "Clear texture",
    message: options.hasUVRegions ? kMessage : kNoRegionsMessage,
    content,
    actions: [
      {
        value: "confirm",
        label: "Clear",
        variant: "danger"
      }
    ],
    focus: "confirm"
  });

  return choice === null ? null : { includeUV };
}
