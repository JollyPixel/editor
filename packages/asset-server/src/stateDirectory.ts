// Import Third-party Dependencies
import {
  STATE_DIRECTORY,
  type AssetSource
} from "@jolly-pixel/asset-source";

// CONSTANTS
export const IDENTITY_SIDECAR_PATH = `${STATE_DIRECTORY}/assets.json`;
export const PROJECTION_STATE_PATH = `${STATE_DIRECTORY}/state.json`;
export const STATE_GITIGNORE_PATH = `${STATE_DIRECTORY}/.gitignore`;
export const EVENTS_DB_PATH = `${STATE_DIRECTORY}/events.db`;
export const PROJECT_FILE_PATH = `${STATE_DIRECTORY}/project.json`;

const kStateGitignoreEntries = [
  "state.json",
  "events.db",
  "events.db-journal",
  "events.db-wal",
  "events.db-shm"
];

export async function ensureStateGitignore(
  source: AssetSource,
  extraEntries: Iterable<string> = []
): Promise<void> {
  const entries = [...new Set([
    ...kStateGitignoreEntries,
    ...extraEntries
  ])];
  const encoder = new TextEncoder();
  const created = await source.writeIfAbsent(
    STATE_GITIGNORE_PATH,
    encoder.encode(`${kStateGitignoreEntries.join("\n")}\n`)
  );
  if (created) {
    return;
  }

  const current = new TextDecoder().decode(
    await source.read(STATE_GITIGNORE_PATH)
  );
  const present = new Set(
    current.split(/\r?\n/).map((line) => line.trim())
  );
  const missing = entries.filter(
    (entry) => !present.has(entry)
  );
  if (missing.length === 0) {
    return;
  }

  const separator = current === "" || current.endsWith("\n") ? "" : "\n";
  await source.write(
    STATE_GITIGNORE_PATH,
    encoder.encode(`${current}${separator}${missing.join("\n")}\n`)
  );
}
