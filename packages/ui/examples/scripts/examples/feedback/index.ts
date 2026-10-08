// Import Internal Dependencies
import type { GalleryEntry } from "../../types.ts";

export const FEEDBACK_EXAMPLES: readonly GalleryEntry[] = [
  {
    id: "feedback/progress",
    title: "Progress and loading",
    load: async() => (await import("./progress.ts")).PROGRESS_EXAMPLE
  },
  {
    id: "feedback/spinner",
    title: "Spinner",
    load: async() => (await import("./spinner.ts")).SPINNER_EXAMPLE
  },
  {
    id: "feedback/log",
    title: "Log",
    load: async() => (await import("./log.ts")).LOG_EXAMPLE
  }
];
