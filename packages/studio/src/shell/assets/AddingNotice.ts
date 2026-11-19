// Import Third-party Dependencies
import type {
  NotificationHandle,
  Notifier
} from "@jolly-pixel/ui";
import { errorMessage } from "@jolly-pixel/utils";

export class AddingNotice {
  #handle: NotificationHandle;
  #label: string;
  #total: number;
  #done = 0;
  #failures: string[] = [];

  constructor(
    notifications: Notifier,
    names: readonly string[]
  ) {
    this.#total = names.length;
    this.#label = names.length === 1 ?
      `"${names[0]}"` :
      `${names.length} files`;
    this.#handle = notifications.notify({
      tone: "loading",
      title: `Adding ${this.#label}`
    });
  }

  advance(
    share: number
  ): void {
    this.#done += share;
    this.#handle.update({ progress: this.#done / this.#total });
  }

  fail(
    name: string,
    error: unknown
  ): void {
    const reason = errorMessage(error);
    this.#failures.push(
      this.#total === 1 ? reason : `"${name}": ${reason}`
    );
  }

  settle(): void {
    const failed = this.#failures.length;
    const message = this.#failures.join("\n");
    if (failed === 0) {
      this.#handle.update({
        tone: "success",
        title: `Added ${this.#label}`,
        progress: null
      });
    }
    else if (failed === this.#total) {
      this.#handle.update({
        tone: "error",
        title: `Could not add ${this.#label}`,
        message,
        progress: null
      });
    }
    else {
      this.#handle.update({
        tone: "warning",
        title: `Added ${this.#total - failed} of ${this.#total} files`,
        message,
        progress: null
      });
    }
  }
}
