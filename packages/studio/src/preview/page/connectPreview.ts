// Import Third-party Dependencies
import { CatalogClient } from "@jolly-pixel/asset-server/client";
import {
  HOST_PARAMS,
  SessionConnection,
  type CatalogOpener,
  type ShellCatalog,
  type ShellChannel
} from "@jolly-pixel/editor.host";
import { Client } from "@jolly-pixel/network/client";
import {
  GUEST_USERNAME,
  peerIdentity
} from "@jolly-pixel/ui";
import { toPeerProfileMetadata } from "@jolly-pixel/ui/network";

export async function connectPreview(
  shell: ShellChannel
): Promise<SessionConnection> {
  if (shell.catalog === null) {
    throw new Error("The studio launched the preview without a catalog.");
  }
  const catalog: ShellCatalog = shell.catalog;
  function openCatalog(
    ...[, options]: Parameters<CatalogOpener>
  ): ReturnType<CatalogOpener> {
    return CatalogClient.connect(catalog, options);
  }

  const { offline } = HOST_PARAMS.read();
  if (offline !== undefined) {
    const { joinOfflineBackend } = await import(
      "@jolly-pixel/editor.host/offline"
    );
    const backend = await joinOfflineBackend({
      name: offline.name,
      observer: true
    });

    return SessionConnection.connect({
      ...backend.connect(),
      openCatalog
    });
  }

  const identity = shell.identity ?? peerIdentity(GUEST_USERNAME);
  const client = new Client({
    profile: toPeerProfileMetadata(identity, {
      observer: true
    })
  });
  shell.renewWhenRefused(client);

  return SessionConnection.connect({
    identity,
    client,
    openCatalog
  });
}
