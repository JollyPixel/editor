// Import Third-party Dependencies
import type { NotificationQueue } from "@jolly-pixel/ui";

export function readChips(
  notifications: NotificationQueue
): string[] {
  return notifications.entries.map(({ tone, title, message }) => (
    message === "" ? `${tone} ${title}` : `${tone} ${title}: ${message}`
  ));
}
