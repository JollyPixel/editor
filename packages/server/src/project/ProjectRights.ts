// Import Third-party Dependencies
import * as z from "zod";
import {
  ADMIN_ROLE,
  GUEST_ROLE
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { ProjectRightRefusedError } from "./errors/ProjectRightRefusedError.ts";

// CONSTANTS
export const SHARE_RIGHT = "studio.$share";
export const EXPORT_RIGHT = "studio.$export";
export const SETTINGS_RIGHT = "studio.$settings";
export const AUDIT_RIGHT = "studio.$audit";
export const BUILT_IN_ROLES: readonly string[] = [ADMIN_ROLE, GUEST_ROLE];

export const PROJECT_RIGHTS = [
  "share",
  "export",
  "readSettings",
  "editSettings",
  "audit",
  "manageAccess"
] as const;

export const rightSchema = z.enum(["write", "read", "void"]);

export type Right = z.infer<typeof rightSchema>;
export type ProjectRight = typeof PROJECT_RIGHTS[number];
export type NamedRight = typeof SETTINGS_RIGHT | typeof AUDIT_RIGHT;
export type GrantedRights = Record<ProjectRight, boolean>;

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

  #granted: GrantedRights;

  constructor(
    granted: Readonly<GrantedRights>
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

  toJSON(): GrantedRights {
    return {
      ...this.#granted
    };
  }
}

export function namedRight(
  rules: Readonly<Record<string, Right>>,
  name: NamedRight
): Right {
  return Object.hasOwn(rules, name) ? rules[name] : "void";
}
