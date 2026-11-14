// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import type { FileDownload } from "../../browser/FileDownload.ts";
import { GENERAL_SECTION } from "../settings/SettingsSections.ts";
import type {
  ExportBlocker,
  ExportTarget
} from "./ExportTarget.ts";

// CONSTANTS
const kNoDefaultScene: ExportBlocker = {
  reason: "Set a default scene to export the game.",
  settingsSection: GENERAL_SECTION
};

export class WebGameExport implements ExportTarget {
  readonly name = "web";
  readonly summary = "A game that runs from any static web server, " +
    "not from file://.";

  blocker(
    defaultScene: AssetRecordData | null
  ): ExportBlocker | null {
    return defaultScene === null ? kNoDefaultScene : null;
  }

  download(
    user: StudioSignedIn
  ): Promise<FileDownload> {
    return user.exportGame();
  }
}
