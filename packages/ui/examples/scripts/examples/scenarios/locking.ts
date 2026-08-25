// Import Third-party Dependencies
import { Client } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  Pane,
  peerColor,
  toPresencePeers
} from "../../../../src/index.ts";
import { RoomPresenceSource } from "../../../../src/network/index.ts";
import type { GalleryExample } from "../../types.ts";

// CONSTANTS
const kFields = [
  { path: "map.width", label: "Width", value: 32 },
  { path: "map.height", label: "Height", value: 24 },
  { path: "map.name", label: "Name", value: "overworld" }
];

/**
 * Gallery scenario parameterized for isolated parallel browser tests.
 */
export const LOCKING_EXAMPLE: GalleryExample = {
  id: "scenarios/locking",
  title: "Locking",
  group: "Scenarios",
  render(host) {
    const params = new URLSearchParams(location.search);
    const roomName = params.get("room");
    const displayName = params.get("as") ?? "Ada";

    const pane = new Pane({
      title: "Map",
      container: host
    });
    const presence = pane.addPresence({ max: 4 });
    const state = Object.fromEntries(
      kFields.map((field) => [field.path, field.value])
    );

    for (const field of kFields) {
      const binding = pane.addBinding(state, field.path, {
        label: field.label,
        path: field.path
      });
      binding.element.id = `field-${field.path.replace(".", "-")}`;
    }

    /**
     * A missing room keeps the manifest sweep independent of the network server.
     */
    if (roomName === null) {
      presence.update([]);

      return () => pane.dispose();
    }

    const client = new Client({});
    const room = client.room(roomName);
    room.join();
    const source = new RoomPresenceSource(room, {
      clientId: `${displayName.toLowerCase()}-${roomName}`,
      displayName,
      color: peerColor(displayName === "Ada" ? 0 : 1)
    });

    function repaint(): void {
      presence.update(
        toPresencePeers(source.peers.values(), source.clientId)
      );
    }
    source.on("change", repaint);
    repaint();

    pane.presence = source;

    return () => {
      source.off("change", repaint);
      source.dispose();
      room.leave();
      client.destroy();
      pane.dispose();
    };
  }
};
