// Import Third-party Dependencies
import { showChoice } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  ConversionChoice,
  ConvertibleFiles
} from "../../catalog/AssetDrop.ts";

// CONSTANTS
const kKeep = "keep";

export async function askConversion(
  group: ConvertibleFiles
): Promise<ConversionChoice | null> {
  const { files, format, kinds } = group;
  const [first] = files;
  const labels = kinds.map((kind) => kind.label).join(" or ");
  const single = files.length === 1 && first !== undefined;

  const choice = await showChoice<string>({
    title: single ? `Add "${first.name}"` : `Add ${files.length} ${format} files`,
    message: single ?
      `Convert it to ${labels}, or keep it as a ${format} file?` :
      `Convert them to ${labels}, or keep them as ${format} files?`,
    actions: [
      {
        value: kKeep,
        label: `Keep ${format}`
      },
      ...kinds.map((kind) => {
        return {
          value: kind.kind,
          label: `Convert to ${kind.label}`,
          variant: "accent" as const
        };
      })
    ],
    focus: kinds[0]?.kind
  });
  if (choice === null) {
    return null;
  }

  return {
    convertTo: kinds.find((kind) => kind.kind === choice) ?? null
  };
}
