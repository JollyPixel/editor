// Import Third-party Dependencies
import { colorFromKey } from "@jolly-pixel/color";

// Import Internal Dependencies
import { resolveStoredPrompt } from "../containers/dialog/dialogHelpers.ts";
import { LocalStorageAdapter } from "../storage/LocalStorageAdapter.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import {
  GUEST_USERNAME,
  type PeerIdentity
} from "./identity.ts";

// CONSTANTS
const kSessionStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});

export interface PromptPeerIdentityOptions {
  title: string;
  storageKey: string;
  storage?: StorageAdapter;
}

export async function promptPeerIdentity(
  options: PromptPeerIdentityOptions
): Promise<PeerIdentity> {
  const username = await resolveStoredPrompt({
    title: options.title,
    label: "Username",
    confirmLabel: "Join",
    storage: options.storage ?? kSessionStorage,
    storageKey: options.storageKey,
    fallbackValue: GUEST_USERNAME
  });
  const peerId = crypto.randomUUID();

  return {
    username,
    peerId,
    color: colorFromKey(peerId)
  };
}
