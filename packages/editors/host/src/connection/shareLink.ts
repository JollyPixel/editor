// Import Third-party Dependencies
import {
  CATALOG_VIEW_ROOM,
  CatalogClient
} from "@jolly-pixel/asset-server/client";
import { connectWebSocket } from "@jolly-pixel/network/client";
import { showChoice } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { guestConnection } from "./guest.ts";
import type { StandaloneConnection } from "./StandaloneConnection.ts";

// CONSTANTS
const kReload = "reload";

export function shareLinkConnection(
  credential: string
): StandaloneConnection {
  const connection = guestConnection(
    () => connectWebSocket({ credential })
  );
  connection.client.on("unauthorized", () => {
    void showLinkEnded();
  });

  return {
    ...connection,
    server: connection.client,
    openCatalog: (client, options) => CatalogClient.connect(client, {
      ...options,
      room: CATALOG_VIEW_ROOM
    })
  };
}

async function showLinkEnded(): Promise<void> {
  const choice = await showChoice({
    title: "Link unavailable",
    message: "This share link was revoked or has expired.",
    actions: [
      {
        value: kReload,
        label: "Reload"
      }
    ],
    cancelLabel: "Close",
    focus: kReload
  });
  if (choice === kReload) {
    location.reload();
  }
}
