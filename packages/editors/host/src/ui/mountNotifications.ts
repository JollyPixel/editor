// Import Third-party Dependencies
import { NotificationQueue } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/notifications";

export interface PageNotifications {
  readonly queue: NotificationQueue;

  dispose(): void;
}

export function mountNotifications(
  parent: HTMLElement = document.querySelector<HTMLElement>("jolly-scope") ??
    document.body
): PageNotifications {
  const queue = new NotificationQueue();
  const stack = parent.ownerDocument.createElement("jolly-notifications");
  parent.append(stack);
  stack.attach(queue);

  return {
    queue,
    dispose() {
      queue.dispose();
      stack.remove();
    }
  };
}
