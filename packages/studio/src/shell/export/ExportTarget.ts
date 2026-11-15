// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import type { FileDownload } from "../../browser/FileDownload.ts";

export type ExportTargetName = "web" | "project";

export interface ExportBlocker {
  readonly reason: string;
  readonly settingsSection: string;
}

export interface ExportTarget {
  readonly name: ExportTargetName;
  readonly label: string;
  readonly summary: string;
  blocker(defaultScene: AssetRecordData | null): ExportBlocker | null;
  download(user: StudioSignedIn): Promise<FileDownload>;
}
