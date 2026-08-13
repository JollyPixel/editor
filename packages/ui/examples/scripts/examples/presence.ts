// Import Internal Dependencies
import { Pane } from "../../../src/index.ts";
import type { GalleryExample } from "../types.ts";

export const PRESENCE_EXAMPLE: GalleryExample = {
  id: "peer/presence",
  title: "Presence",
  group: "Peer",
  render(host) {
    const pane = new Pane({
      title: "Session",
      container: host
    });
    const presence = pane.addPresence({ max: 2 });
    presence.update([
      {
        id: "ada",
        username: "Ada",
        color: "#f94144"
      },
      {
        id: "lin",
        username: "Lin",
        color: "#43aa8b"
      },
      {
        id: "sam",
        username: "Sam",
        color: "#577590",
        self: true
      }
    ]);

    return () => pane.dispose();
  }
};
