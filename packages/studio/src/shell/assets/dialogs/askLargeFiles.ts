// Import Third-party Dependencies
import { showConfirm } from "@jolly-pixel/ui/elements/dialog";
import { formatBytes } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { DroppedFile } from "../../../browser/DroppedFile.ts";

export function askLargeFiles(
  files: readonly DroppedFile[]
): Promise<boolean> {
  const [first] = files;
  const single = files.length === 1 && first !== undefined;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const weight = `${single ? "It weighs" : "They weigh"} ${formatBytes(total)}.`;

  return showConfirm({
    title: single ? `"${first.name}" is large` : `${files.length} large files`,
    message: `${weight} Large files are slow to upload, ` +
      "and everyone who opens one downloads all of it. Continue?",
    confirmLabel: "Continue"
  });
}
