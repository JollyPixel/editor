// Import Third-party Dependencies
import { Client } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { Pane } from "../shared/facadePane.ts";
import {
  PeerRoster,
  RoomFieldLocks
} from "../../../../src/network/index.ts";
import type { GalleryExample } from "../../types.ts";

// CONSTANTS
const kFields = [
  { path: "map.width", label: "Width", value: 32 },
  { path: "map.height", label: "Height", value: 24 },
  { path: "map.name", label: "Name", value: "overworld" }
];

export const LOCKING_EXAMPLE: GalleryExample = {
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

    if (roomName === null) {
      presence.update([]);

      return () => pane.dispose();
    }

    const client = new Client({
      profile: {
        username: displayName,
        peerId: `${displayName.toLowerCase()}-${roomName}`
      }
    });
    const room = client.room(roomName);
    room.join();
    const roster = new PeerRoster({
      room,
      publish: (peers) => presence.update(peers)
    });
    const fieldLocks = new RoomFieldLocks(room);
    pane.fieldLocks = fieldLocks;

    return () => {
      fieldLocks.dispose();
      roster.dispose();
      room.leave();
      client.destroy();
      pane.dispose();
    };
  }
};
