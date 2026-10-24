// Import Internal Dependencies
import { LocalStorageAdapter } from "../storage/LocalStorageAdapter.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import {
  GUEST_USERNAME,
  peerIdentity,
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
  const { resolveStoredPrompt } = await import(
    "../containers/dialog/dialogHelpers.ts"
  );
  const username = await resolveStoredPrompt({
    title: options.title,
    intent: "info",
    label: "Username",
    confirmLabel: "Join",
    storage: options.storage ?? kSessionStorage,
    storageKey: options.storageKey,
    fallbackValue: GUEST_USERNAME
  });

  return peerIdentity(username);
}
