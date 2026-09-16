// Import Third-party Dependencies
import { showChoice } from "@jolly-pixel/ui";

export type ImportTextureChoice = "replace" | "add";

export interface ImportTextureDialogOptions {
  name: string;
}

export function showImportTextureDialog(
  options: ImportTextureDialogOptions
): Promise<ImportTextureChoice | null> {
  return showChoice<ImportTextureChoice>({
    title: "Import texture",
    message: `Replace the current texture with "${options.name}", ` +
      "or add it as a new texture?",
    actions: [
      {
        value: "replace",
        label: "Replace current"
      },
      {
        value: "add",
        label: "Add as new",
        variant: "accent"
      }
    ],
    focus: "add"
  });
}
