// Import Third-party Dependencies
import { STATE_DIRECTORY } from "@jolly-pixel/asset-source";

export { STATE_DIRECTORY };

export const IDENTITY_SIDECAR_PATH = `${STATE_DIRECTORY}/assets.json`;
export const PROJECTION_STATE_PATH = `${STATE_DIRECTORY}/state.json`;
export const STATE_GITIGNORE_PATH = `${STATE_DIRECTORY}/.gitignore`;
export const EVENTS_DB_PATH = `${STATE_DIRECTORY}/events.db`;

export const STATE_GITIGNORE_CONTENT = `state.json
events.db
events.db-journal
events.db-wal
`;

export const ASSET_EVENT_PREFIX = "asset.";
