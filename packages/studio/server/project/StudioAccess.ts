// Import Third-party Dependencies
import * as z from "zod";
import {
  ACCOUNTS_ROOM,
  ADMIN_ROLE,
  GUEST_ROLE
} from "@jolly-pixel/accounts";
import { AccountRoles } from "@jolly-pixel/accounts/node";
import { CATALOG_ROOM } from "@jolly-pixel/asset-server";
import {
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
  accessSectionSchema,
  namedRight,
  type AccessSection,
  type NamedRight
} from "../../shared/api/project.ts";
import { ProjectRights } from "../../shared/ProjectRights.ts";

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
  accessRequests: false
} as const satisfies StudioAccessData;

const kAccessSectionSchema = z.object({
  access: z.object({
    defaultRole: accessSectionSchema.shape.defaultRole.default(
      DEFAULT_ACCESS.defaultRole
    ),
    roles: accessSectionSchema.shape.roles.default(DEFAULT_ACCESS.roles),
    accessRequests: accessSectionSchema.shape.accessRequests.default(
      DEFAULT_ACCESS.accessRequests
    )
  }).optional()
});

export type StudioAccessData = AccessSection;

export class StudioAccess {
  static read(
    document: unknown,
    source: string
  ): StudioAccess {
    const section = kAccessSectionSchema.safeParse(document);
    if (!section.success) {
      throw new TypeError(
        `"${source}" is invalid:\n${z.prettifyError(section.error)}`
      );
    }

    return StudioAccess.from(
      section.data.access ?? DEFAULT_ACCESS,
      source
    );
  }

  static from(
    data: StudioAccessData,
    source: string
  ): StudioAccess {
    for (const role of BUILT_IN_ROLES) {
      if (Object.hasOwn(data.roles, role)) {
        throw new TypeError(
          `"${source}" declares the built-in "${role}" role`
        );
      }
    }
    if (!Object.hasOwn(data.roles, data.defaultRole)) {
      throw new TypeError(
        `"${source}" has a defaultRole "${data.defaultRole}" that names no role`
      );
    }

    return new StudioAccess(
      structuredClone(data),
      new AccountRoles({
        roles: Object.keys(data.roles),
        defaultRole: data.defaultRole
      })
    );
  }

  readonly rights: RightsMap;
  readonly roles: AccountRoles;
  readonly accessRequests: boolean;

  #data: StudioAccessData;
  #table: RightsTable;

  private constructor(
    data: StudioAccessData,
    roles: AccountRoles
  ) {
    this.rights = {
      [ADMIN_ROLE]: { ...kAdminRights },
      [GUEST_ROLE]: { ...kGuestRights },
      ...structuredClone(data.roles)
    };
    this.roles = roles;
    this.accessRequests = data.accessRequests;
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

  toJSON(): StudioAccessData {
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
