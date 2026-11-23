// Import Internal Dependencies
import { GameBuildError } from "./errors/GameBuildError.ts";
import { GameExportError } from "./errors/GameExportError.ts";
import { UnknownAssetError } from "../project/errors/UnknownAssetError.ts";
import type { DomainFailure } from "../http/api.ts";

// CONSTANTS
export const GAME_FAILURES: readonly DomainFailure[] = [
  [UnknownAssetError, 404, "not-found"],
  [GameBuildError, 422, "build-failed"],
  [GameExportError, 409, "not-exportable"]
];
