// Import Third-party Dependencies
import {
  Select,
  onFieldChange,
  showChoice,
  type JollyOption
} from "@jolly-pixel/ui";
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kDefaultUvSize = 16;

export const IMPORT_UV_SIZES: readonly number[] = [16, 32, 64, 128, 256];

export type ImportTextureChoice = "replace" | "add";

export interface ImportTextureDialogOptions {
  name: string;
  size: Vec2;
}

export interface ImportTextureDialogResult {
  choice: ImportTextureChoice;
  uvSize: number | null;
}

export async function showImportTextureDialog(
  options: ImportTextureDialogOptions
): Promise<ImportTextureDialogResult | null> {
  const maxSize = Math.min(options.size.x, options.size.y);
  const sizes: JollyOption<number>[] = IMPORT_UV_SIZES.map((size) => {
    return {
      value: size,
      label: `${size} × ${size}`,
      disabled: size > maxSize
    };
  });
  let uvSize = kDefaultUvSize <= maxSize ? kDefaultUvSize : null;

  const content: Node[] = [];
  if (uvSize !== null) {
    const select = new Select<number>();
    select.label = "UV size of a new texture";
    select.options = sizes;
    select.value = uvSize;
    select.setAttribute("part", "import-uv-size");
    onFieldChange<number>(select, (value) => {
      uvSize = value;
    });
    content.push(select);
  }

  const choice = await showChoice<ImportTextureChoice>({
    title: "Import texture",
    icon: "import",
    message: `Replace the current texture with "${options.name}", ` +
      "or add it as a new texture?",
    content,
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

  return choice === null ? null : { choice, uvSize };
}
