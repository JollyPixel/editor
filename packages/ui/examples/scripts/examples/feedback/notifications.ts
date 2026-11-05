// Import Internal Dependencies
import "../../../../src/feedback/Notifications.ts";
import type { GalleryExample } from "../../types.ts";
import { NotificationQueue } from "../../../../src/feedback/NotificationQueue.ts";
import {
  NOTIFICATION_PLACEMENTS,
  type NotificationInit
} from "../../../../src/feedback/NotificationQueue.types.ts";
import { button } from "../shared/containerBuilders.ts";

// CONSTANTS
const kStepMs = 300;
const kStep = 0.125;
const kSamples: readonly (NotificationInit & { action: string; })[] = [
  {
    action: "notify-success",
    tone: "success",
    title: "Map saved"
  },
  {
    action: "notify-info",
    tone: "info",
    title: "Grid snapping enabled",
    source: "Voxel map"
  },
  {
    action: "notify-warning",
    tone: "warning",
    title: "Connection is slow",
    message: "Changes are kept locally until it recovers."
  },
  {
    action: "notify-error",
    tone: "error",
    title: "Could not add \"hero.png\"",
    message: "disk full"
  }
];

export const NOTIFICATIONS_EXAMPLE: GalleryExample = {
  render(host) {
    const queue = new NotificationQueue();
    const timers = new Set<number>();

    const root = document.createElement("div");
    root.className = "notifications-example";

    const tones = document.createElement("div");
    tones.className = "chrome-row";
    for (const { action, ...init } of kSamples) {
      const trigger = button(init.tone, init.tone === "error" ? "danger" : undefined);
      trigger.dataset.action = action;
      trigger.addEventListener("click", () => queue.notify(init));
      tones.append(trigger);
    }

    const tasks = document.createElement("div");
    tasks.className = "chrome-row";
    const upload = button("Upload", "accent");
    upload.dataset.action = "notify-upload";
    const failing = button("Failing upload");
    failing.dataset.action = "notify-failing-upload";
    const clear = button("Clear", "danger");
    clear.dataset.action = "notify-clear";
    tasks.append(upload, failing, clear);

    function run(
      fails: boolean
    ): void {
      const task = queue.notify({
        tone: "loading",
        title: "Uploading \"forest.glb\"",
        progress: 0
      });
      let progress = 0;
      const timer = window.setInterval(() => {
        progress += kStep;
        if (fails && progress >= 0.5) {
          task.update({
            tone: "error",
            title: "Could not upload \"forest.glb\"",
            message: "the server closed the connection",
            progress: null
          });
        }
        else if (progress >= 1) {
          task.update({
            tone: "success",
            title: "Uploaded \"forest.glb\"",
            progress: null
          });
        }
        else {
          task.update({ progress });

          return;
        }
        window.clearInterval(timer);
        timers.delete(timer);
      }, kStepMs);
      timers.add(timer);
    }

    upload.addEventListener("click", () => run(false));
    failing.addEventListener("click", () => run(true));
    clear.addEventListener("click", () => queue.clear());

    const placements = document.createElement("div");
    placements.className = "chrome-row";
    const element = document.createElement("jolly-notifications");
    for (const placement of NOTIFICATION_PLACEMENTS) {
      const choice = button(placement);
      choice.dataset.placement = placement;
      choice.addEventListener("click", () => {
        element.placement = placement;
      });
      placements.append(choice);
    }

    root.append(tones, tasks, placements, element);
    host.append(root);
    element.attach(queue);

    return () => {
      for (const timer of timers) {
        window.clearInterval(timer);
      }
      queue.dispose();
      element.remove();
    };
  }
};
