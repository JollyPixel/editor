// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { GameExportAssets } from "@jolly-pixel/server";

// Import Internal Dependencies
import type { FileDownload } from "../../browser/FileDownload.ts";

export type ExportTargetName = "web" | "project";

export interface ExportBlocker {
  readonly reason: string;
  readonly settingsSection: string;
}

export interface ExportRequest {
  readonly fileName: string;
  readonly assets: GameExportAssets;
}

export interface ExportTarget {
  readonly name: ExportTargetName;
  readonly label: string;
  readonly summary: string;
  readonly prunesAssets: boolean;
  blocker(defaultScene: AssetRecordData | null): ExportBlocker | null;
  download(request: ExportRequest): Promise<FileDownload>;
}
