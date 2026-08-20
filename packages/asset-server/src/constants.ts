/**
 * Workspace-local files excluded from listing and reconciliation.
 */
export const STATE_DIRECTORY = ".jollypixel";

/**
 * Committed path-to-AssetId mapping that preserves ids across clones.
 */
export const IDENTITY_SIDECAR_PATH = `${STATE_DIRECTORY}/assets.json`;

/**
 * Machine-local replay positions. Never committed.
 */
export const PROJECTION_STATE_PATH = `${STATE_DIRECTORY}/state.json`;

export const STATE_GITIGNORE_PATH = `${STATE_DIRECTORY}/.gitignore`;

export const STATE_GITIGNORE_CONTENT = `state.json
events.db
events.db-journal
events.db-wal
`;

export const ASSET_EVENT_PREFIX = "asset.";
