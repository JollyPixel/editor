// Import Third-party Dependencies
import * as z from "zod";
import {
  ACCOUNTS_ROOM,
  ADMIN_ROLE,
  GUEST_ROLE,
  type JoinMode
} from "@jolly-pixel/accounts";
import { AccountRoles } from "@jolly-pixel/accounts/node";
import { CATALOG_ROOM } from "@jolly-pixel/asset-server";
import {
  JOIN_EVENT,
  RightsTable,
  type Right,
  type RightsMap
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  AUDIT_RIGHT,
  BUILT_IN_ROLES,
  EXPORT_RIGHT,
  SETTINGS_RIGHT,
  SHARE_RIGHT,
  ProjectRights,
  namedRight,
  type NamedRight
} from "../ProjectRights.ts";
import {
  accessSectionSchema,
  type AccessSection
} from "../ProjectSections.ts";
import { InvalidSettingsError } from "./errors/InvalidSettingsError.ts";

// CONSTANTS
const kAdminRights = {
  "*": "write"
} as const;
const kGuestRights = {
  [`${CATALOG_ROOM}.*`]: "void",
  [`${ACCOUNTS_ROOM}.*`]: "void",
  "*.$join": "write",
  "*.$presence": "write",
  "*": "read"
} as const;

export const DEFAULT_ACCESS = {
  defaultRole: "spectator",
  roles: {
    member: {
      "*": "write"
    },
    spectator: {
      "*.$join": "write",
      "*.$presence": "write",
      "*": "read"
    }
  },
  join: "request"
} as const satisfies ProjectAccessData;

const kAccessSectionSchema = z.object({
  access: z.object({
    defaultRole: accessSectionSchema.shape.defaultRole.default(
      DEFAULT_ACCESS.defaultRole
    ),
    roles: accessSectionSchema.shape.roles.default(DEFAULT_ACCESS.roles),
    join: accessSectionSchema.shape.join.default(DEFAULT_ACCESS.join)
  }).optional()
});

export type ProjectAccessData = AccessSection;

export class ProjectAccess {
  static read(
    document: unknown,
    source: string
  ): ProjectAccess {
    const section = kAccessSectionSchema.safeParse(document);
    if (!section.success) {
      throw new InvalidSettingsError(
        `"${source}" is invalid:\n${z.prettifyError(section.error)}`
      );
    }

    return ProjectAccess.from(
      section.data.access ?? DEFAULT_ACCESS,
      source
    );
  }

  static from(
    data: ProjectAccessData,
    source: string
  ): ProjectAccess {
    for (const role of BUILT_IN_ROLES) {
      if (Object.hasOwn(data.roles, role)) {
        throw new InvalidSettingsError(
          `"${source}" declares the built-in "${role}" role`
        );
      }
    }
    if (!Object.hasOwn(data.roles, data.defaultRole)) {
      throw new InvalidSettingsError(
        `"${source}" has a defaultRole "${data.defaultRole}" that names no role`
      );
    }

    return new ProjectAccess(
      structuredClone(data),
      new AccountRoles({
        roles: Object.keys(data.roles),
        defaultRole: data.defaultRole
      })
    );
  }

  readonly rights: RightsMap;
  readonly roles: AccountRoles;
  readonly join: JoinMode;

  #data: ProjectAccessData;
  #table: RightsTable;

  private constructor(
    data: ProjectAccessData,
    roles: AccountRoles
  ) {
    this.rights = {
      [ADMIN_ROLE]: { ...kAdminRights },
      [GUEST_ROLE]: { ...kGuestRights },
      ...structuredClone(data.roles)
    };
    this.roles = roles;
    this.join = data.join;
    this.#data = data;
    this.#table = new RightsTable(this.rights, roles.defaultRole);
  }

  projectRights(
    role: string
  ): ProjectRights {
    const settings = this.#named(role, SETTINGS_RIGHT);

    return new ProjectRights({
      share: this.#table.check(role, SHARE_RIGHT) === "write",
      export: this.#table.check(role, EXPORT_RIGHT) === "write",
      readSettings: settings !== "void",
      editSettings: settings === "write",
      audit: this.#named(role, AUDIT_RIGHT) !== "void",
      manageAccess: role === ADMIN_ROLE
    });
  }

  opens(
    role: string,
    room: string
  ): boolean {
    return this.#table.check(role, `${room}.${JOIN_EVENT}`) === "write";
  }

  toJSON(): ProjectAccessData {
    return structuredClone(this.#data);
  }

  #named(
    role: string,
    name: NamedRight
  ): Right {
    if (role === ADMIN_ROLE) {
      return "write";
    }

    return Object.hasOwn(this.#data.roles, role) ?
      namedRight(this.#data.roles[role], name) :
      "void";
  }
}
