// Import Third-party Dependencies
import type { EnvironmentDocument } from "@jolly-pixel/asset.environment/client";
import { CommandHistory } from "@jolly-pixel/history";

// CONSTANTS
const kLimit = 100;

export const ENVIRONMENT_HISTORY_SCOPE = "environment";

export type EnvironmentHistory = CommandHistory<typeof ENVIRONMENT_HISTORY_SCOPE>;

export function createEnvironmentHistory(
  document: EnvironmentDocument
): EnvironmentHistory {
  const history: EnvironmentHistory = new CommandHistory({
    limit: kLimit
  });
  history.register(document.history({ scope: ENVIRONMENT_HISTORY_SCOPE }));

  return history;
}
