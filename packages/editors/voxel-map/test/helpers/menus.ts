// Import Third-party Dependencies
import type { ContextMenuEntry } from "@jolly-pixel/ui";

export function choices(
  entries: readonly ContextMenuEntry[]
): string[] {
  return entries.flatMap((entry) => {
    if (entry === "separator" || entry.disabled === true) {
      return [];
    }

    return entry.items === undefined ? [entry.id] : choices(entry.items);
  });
}
