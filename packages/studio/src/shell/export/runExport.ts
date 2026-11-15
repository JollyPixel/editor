// Import Third-party Dependencies
import type { Notifier } from "@jolly-pixel/ui";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { FileDownload } from "../../browser/FileDownload.ts";

export interface ExportRun {
  label: string;
  fileName: string;
  download: Promise<FileDownload>;
}

export async function runExport(
  notifications: Notifier,
  run: ExportRun
): Promise<void> {
  const exporting = notifications.notify({
    tone: "loading",
    title: `Exporting the ${run.label}`
  });
  try {
    const download = (await run.download).renamed(run.fileName);
    download.save();
    exporting.update({
      tone: "success",
      title: `Exported "${download.fileName}"`
    });
  }
  catch (error) {
    exporting.update({
      tone: "error",
      title: `Could not export the ${run.label}`,
      message: errorMessage(error)
    });
  }
}
