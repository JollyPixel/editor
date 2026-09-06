// Import Third-party Dependencies
import { colorFromKey } from "@jolly-pixel/color";
import {
  LocalStorageAdapter,
  resolveStoredPrompt
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { EditorIdentity } from "./identity.ts";

// CONSTANTS
const kUsernameStorageKey = "voxel-map:username";
const kFallbackUsername = "Guest";
const kUsernameStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});

export async function resolveEditorIdentity(): Promise<EditorIdentity> {
  const username = await resolveStoredPrompt({
    title: "Join voxel map",
    label: "Username",
    confirmLabel: "Join",
    storage: kUsernameStorage,
    storageKey: kUsernameStorageKey,
    fallbackValue: kFallbackUsername
  });
  const peerId = crypto.randomUUID();

  return {
    username,
    peerId,
    color: colorFromKey(peerId)
  };
}
