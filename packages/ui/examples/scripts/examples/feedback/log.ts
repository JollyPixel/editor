// Import Third-party Dependencies
import { html } from "lit";

// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  LogQueue,
  peerColor
} from "../../../../src/index.ts";
import { button } from "../shared/containerBuilders.ts";

// CONSTANTS
const kGracePeriodMs = 6_000;
const kPeers = [
  "Ada",
  "Grace",
  "Alan"
] as const;
const kMessages = [
  "Camera switched to free fly",
  "Camera switched to pivot",
  "Grid snapping enabled",
  "Autosave complete"
] as const;

export const LOG_EXAMPLE: GalleryExample = {
  id: "feedback/log",
  title: "Log",
  group: "Feedback",
  render(host) {
    const queue = new LogQueue({
      max: 5,
      gracePeriod: kGracePeriodMs
    });

    const root = document.createElement("div");
    root.className = "log-example";

    const stage = document.createElement("div");
    stage.className = "log-stage";
    const element = document.createElement("jolly-log");
    stage.append(element);

    const controls = document.createElement("div");
    controls.className = "chrome-row";
    const join = button("Peer joins", "accent");
    join.dataset.action = "log-join";
    const status = button("Status message");
    status.dataset.action = "log-status";
    const burst = button("Burst of six");
    burst.dataset.action = "log-burst";
    const clear = button("Clear", "danger");
    clear.dataset.action = "log-clear";
    controls.append(join, status, burst, clear);

    let peer = 0;
    let message = 0;

    join.addEventListener("click", () => {
      const name = kPeers[peer % kPeers.length];
      queue.push(html`<b style="color: ${peerColor(peer)}">${name}</b> has joined`);
      peer += 1;
    });
    status.addEventListener("click", () => {
      queue.push(kMessages[message % kMessages.length]);
      message += 1;
    });
    burst.addEventListener("click", () => {
      for (let index = 0; index < 6; index++) {
        queue.push(`Burst message ${index + 1}`);
      }
    });
    clear.addEventListener("click", () => queue.clear());

    const unsubscribe = queue.subscribe((entries) => {
      element.entries = entries;
    });

    root.append(controls, stage);
    host.append(root);

    return () => {
      unsubscribe();
      queue.dispose();
      root.remove();
    };
  }
};
