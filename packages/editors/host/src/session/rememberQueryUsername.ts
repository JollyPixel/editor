// Import Internal Dependencies
import { IDENTITY_STORAGE_KEY } from "./EditorSession.ts";
import { HOST_PARAMS } from "../params/HostParams.ts";

export function rememberQueryUsername(
  search?: string
): void {
  const { username } = HOST_PARAMS.read(search);
  if (username !== undefined) {
    sessionStorage.setItem(IDENTITY_STORAGE_KEY, username);
  }
}
