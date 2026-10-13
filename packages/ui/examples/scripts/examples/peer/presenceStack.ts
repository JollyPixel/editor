// Import Internal Dependencies
import "../../../../src/peer/PresenceStack.ts";
import type { GalleryExample } from "../../types.ts";

export const PRESENCE_STACK_EXAMPLE: GalleryExample = {
  render(host) {
    const stack = document.createElement("jolly-presence-stack");
    stack.style.marginBlockStart = "48px";
    stack.max = 4;
    stack.selectable = true;
    stack.peers = [
      {
        clientId: "sam",
        displayName: "Sam",
        color: "#577590",
        self: true
      },
      {
        clientId: "ada",
        displayName: "Ada",
        color: "#f94144"
      },
      {
        clientId: "lin",
        displayName: "Lin",
        color: "#43aa8b",
        badge: "via link"
      },
      {
        clientId: "zoe",
        displayName: "Zoe",
        color: "#f9c74f"
      },
      {
        clientId: "kai",
        displayName: "Kai",
        color: "#90be6d"
      }
    ];

    const selected = document.createElement("output");
    selected.textContent = "Selected: none";
    stack.addEventListener("jolly-peer-select", (event) => {
      selected.textContent = `Selected: ${event.detail.clientId}`;
    });

    host.append(stack, document.createElement("br"), selected);
  }
};
