// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type {
  ChoiceAction,
  ChoiceOptions
} from "@jolly-pixel/ui";
import { showChoice } from "@jolly-pixel/ui/elements/dialog";

// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import type { FileDownload } from "../../browser/FileDownload.ts";

// CONSTANTS
const kProject: ChoiceAction<ExportTarget> = {
  value: "project",
  label: "Export project"
};
const kGame: ChoiceAction<ExportTarget> = {
  value: "game",
  label: "Export game",
  variant: "accent"
};

export type ExportTarget = "project" | "game";

export function exportChoice(
  defaultScene: AssetRecordData | null
): ChoiceOptions<ExportTarget> {
  if (defaultScene === null) {
    return {
      title: "Export",
      message: "Export the project sources. Set a default scene in Settings to export the game too.",
      actions: [kProject],
      focus: "project"
    };
  }

  return {
    title: "Export",
    message: "Export the project sources, or a game that runs from any web server?",
    actions: [kProject, kGame],
    focus: "game"
  };
}

export function askExport(
  defaultScene: AssetRecordData | null
): Promise<ExportTarget | null> {
  return showChoice(exportChoice(defaultScene));
}

export function exportFile(
  user: StudioSignedIn,
  target: ExportTarget
): Promise<FileDownload> {
  return target === "game" ? user.exportGame() : user.exportProject();
}
