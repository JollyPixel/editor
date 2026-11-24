// Import Third-party Dependencies
import {
  AssetArchiveError,
  UnknownAssetKindError
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { domainFailures } from "../../http/node/apiFailure.ts";
import { ProjectFolderError } from "./errors/ProjectFolderError.ts";
import { ProjectUnavailableError } from "./errors/ProjectUnavailableError.ts";
import { UnknownProjectError } from "./errors/UnknownProjectError.ts";

export const projectsFailures = domainFailures([
  [UnknownProjectError, 404, "not-found"],
  [ProjectUnavailableError, 503, "project-unavailable"],
  [ProjectFolderError, 409, "refused"],
  [AssetArchiveError, 400, "invalid-request"],
  [UnknownAssetKindError, 400, "invalid-request"]
]);
