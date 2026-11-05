// Import Third-party Dependencies
import type { NotificationMessage } from "@jolly-pixel/editor.host";
import type {
  NotificationHandle,
  NotificationTone,
  Notifier
} from "@jolly-pixel/ui";

interface FrameNotification {
  handle: NotificationHandle;
  tone: NotificationTone;
}

export class FrameNotifications {
  #notifier: Notifier;
  #frames = new Map<string, Map<string, FrameNotification>>();

  constructor(
    notifier: Notifier
  ) {
    this.#notifier = notifier;
  }

  receive(
    frameId: string,
    source: string,
    message: NotificationMessage
  ): void {
    const known = this.#frames.get(frameId);
    switch (message.action) {
      case "notify": {
        const notifications = known ?? new Map<string, FrameNotification>();
        this.#frames.set(frameId, notifications);
        notifications.set(message.id, {
          handle: this.#notifier.notify({
            ...message.notification,
            source
          }),
          tone: message.notification.tone
        });
        break;
      }
      case "update": {
        const current = known?.get(message.id);
        if (current !== undefined) {
          current.handle.update({
            ...message.patch,
            source
          });
          current.tone = message.patch.tone ?? current.tone;
        }
        break;
      }
      case "dismiss":
        known?.get(message.id)?.handle.dismiss();
        known?.delete(message.id);
        break;
      default: {
        const unhandled: never = message;
        throw new Error(
          `Unhandled notification message: ${JSON.stringify(unhandled)}`
        );
      }
    }
  }

  release(
    frameId: string
  ): void {
    for (const { handle, tone } of this.#frames.get(frameId)?.values() ?? []) {
      if (tone === "loading") {
        handle.dismiss();
      }
    }
    this.#frames.delete(frameId);
  }

  dispose(): void {
    for (const frameId of [...this.#frames.keys()]) {
      this.release(frameId);
    }
  }
}
