// Import Third-party Dependencies
import { showChoice } from "@jolly-pixel/ui/elements/dialog";

// Import Internal Dependencies
import type { TextureConflict } from "../model/MaterialPalette.ts";

export function askTextureConflict(
  paths: readonly string[]
): Promise<TextureConflict | null> {
  const list = document.createElement("ul");
  for (const path of paths) {
    const item = document.createElement("li");
    item.textContent = path;
    list.append(item);
  }

  return showChoice<TextureConflict>({
    title: "Import textures",
    message: paths.length === 1 ?
      "This texture already exists. Replace its content everywhere it is used, or keep both?" :
      `${paths.length} textures already exist. Replace their content everywhere they are used, or keep both?`,
    content: [list],
    actions: [
      {
        value: "keep",
        label: "Keep both"
      },
      {
        value: "replace",
        label: "Replace",
        variant: "accent"
      }
    ],
    focus: "replace"
  });
}
