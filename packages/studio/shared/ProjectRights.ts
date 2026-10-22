// Import Internal Dependencies
import type {
  ProjectReply,
  ProjectRight
} from "./api/project.ts";
import { ProjectRightRefusedError } from "./errors/ProjectRightRefusedError.ts";

// CONSTANTS
const kRefusals = {
  share: "this role cannot share assets",
  export: "this role cannot export the project",
  readSettings: "this role cannot read the project settings",
  editSettings: "this role cannot change the project settings",
  audit: "this role cannot read the audit log",
  manageAccess: "only an admin changes the access settings"
} as const satisfies Record<ProjectRight, string>;

export class ProjectRights {
  static readonly NONE = new ProjectRights({
    share: false,
    export: false,
    readSettings: false,
    editSettings: false,
    audit: false,
    manageAccess: false
  });

  #granted: ProjectReply;

  constructor(
    granted: Readonly<ProjectReply>
  ) {
    this.#granted = {
      ...granted
    };
  }

  allows(
    right: ProjectRight
  ): boolean {
    return this.#granted[right];
  }

  require(
    right: ProjectRight
  ): void {
    if (!this.#granted[right]) {
      throw new ProjectRightRefusedError(kRefusals[right]);
    }
  }

  toJSON(): ProjectReply {
    return {
      ...this.#granted
    };
  }
}
