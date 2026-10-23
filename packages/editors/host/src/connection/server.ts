// Import Third-party Dependencies
import { Client } from "@jolly-pixel/network/client";
import { promptPeerIdentity } from "@jolly-pixel/ui";
import { toPeerProfileMetadata } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { HostLogger } from "../debug/readDebugLogger.ts";
import { PendingOutboxes } from "../lease/outbox/PendingOutboxes.ts";
import type { ShellChannel } from "../shell/ShellChannel.ts";
import type { StandaloneConnection } from "./StandaloneConnection.ts";

// CONSTANTS
export const IDENTITY_STORAGE_KEY = "jolly-pixel:username";

export interface EditorIdentityOptions {
  title: string;
}

export interface ServerConnectionOptions {
  identity: EditorIdentityOptions;
  shell: ShellChannel | null;
  logger: HostLogger;
}

export async function serverConnection(
  options: ServerConnectionOptions
): Promise<StandaloneConnection> {
  const { shell, logger } = options;
  const identity = shell?.identity ?? await logger.step(
    "identity",
    () => promptPeerIdentity({
      title: options.identity.title,
      storageKey: IDENTITY_STORAGE_KEY
    })
  );
  const client = new Client({
    profile: toPeerProfileMetadata(identity)
  });
  shell?.renewWhenRefused(client);

  return {
    identity,
    client,
    server: client,
    openOutboxes: () => PendingOutboxes.open()
  };
}
