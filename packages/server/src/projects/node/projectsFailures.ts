// Import Internal Dependencies
import { domainFailures } from "../../http/node/apiFailure.ts";
import { ProjectCreationError } from "./errors/ProjectCreationError.ts";
import { ProjectUnavailableError } from "./errors/ProjectUnavailableError.ts";
import { UnknownProjectError } from "./errors/UnknownProjectError.ts";

export const projectsFailures = domainFailures([
  [UnknownProjectError, 404, "not-found"],
  [ProjectUnavailableError, 503, "project-unavailable"],
  [ProjectCreationError, 409, "refused"]
]);
