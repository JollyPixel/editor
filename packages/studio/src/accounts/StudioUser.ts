// Import Internal Dependencies
import type { OfflineUser } from "./OfflineUser.ts";
import type { StudioSignedIn } from "./StudioSignedIn.ts";

// CONSTANTS
export const STUDIO_USER_CHANGE = "change";

export type StudioUser = StudioSignedIn | OfflineUser;
