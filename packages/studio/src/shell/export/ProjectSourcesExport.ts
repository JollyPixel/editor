// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import type { FileDownload } from "../../browser/FileDownload.ts";
import type {
  ExportBlocker,
  ExportTarget
} from "./ExportTarget.ts";

export class ProjectSourcesExport implements ExportTarget {
  readonly name = "project";
  readonly label = "project sources";
  readonly summary = "The project sources, to back up or move to " +
    "another studio.";
  readonly prunesAssets = false;

  #user: Pick<StudioSignedIn, "exportProject">;

  constructor(
    user: Pick<StudioSignedIn, "exportProject">
  ) {
    this.#user = user;
  }

  blocker(): ExportBlocker | null {
    return null;
  }

  download(): Promise<FileDownload> {
    return this.#user.exportProject();
  }
}
