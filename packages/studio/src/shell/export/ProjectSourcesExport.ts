// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import type { FileDownload } from "../../browser/FileDownload.ts";
import type {
  ExportBlocker,
  ExportTarget
} from "./ExportTarget.ts";

export class ProjectSourcesExport implements ExportTarget {
  readonly name = "project";
  readonly summary = "The project sources, to back up or move to " +
    "another studio.";

  blocker(): ExportBlocker | null {
    return null;
  }

  download(
    user: StudioSignedIn
  ): Promise<FileDownload> {
    return user.exportProject();
  }
}
