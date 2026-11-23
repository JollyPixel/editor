// Import Third-party Dependencies
import type {
  NotificationQueue,
  Notifier
} from "@jolly-pixel/ui";

export function readChips(
  notifications: NotificationQueue
): string[] {
  return notifications.entries.map(({ tone, title, message }) => (
    message === "" ? `${tone} ${title}` : `${tone} ${title}: ${message}`
  ));
}

export function recordErrors(
  notifications: Notifier,
  errors: string[]
): Notifier {
  return {
    notify: (init) => {
      if (init.tone === "error") {
        errors.push(init.title);
      }

      return notifications.notify(init);
    }
  };
}
