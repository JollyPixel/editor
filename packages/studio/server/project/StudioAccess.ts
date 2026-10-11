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
  type RightsMap
} from "@jolly-pixel/network";

// CONSTANTS
const kRights = ["write", "read", "void"] as const;
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
const kBuiltInRoles = [ADMIN_ROLE, GUEST_ROLE];
export const SHARE_RIGHT = "studio.$share";
const kRolesSchema = z.record(
  z.string().min(1),
  z.record(z.string().min(1), z.enum(kRights))
);

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
    defaultRole: z.string().min(1).default(DEFAULT_ACCESS.defaultRole),
    roles: kRolesSchema.default(DEFAULT_ACCESS.roles),
    accessRequests: z.boolean().default(
      DEFAULT_ACCESS.accessRequests
    )
  }).optional()
});

export interface StudioAccessData {
  defaultRole: string;
  roles: RightsMap;
  accessRequests: boolean;
}

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
    for (const role of kBuiltInRoles) {
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
      {
        [ADMIN_ROLE]: { ...kAdminRights },
        [GUEST_ROLE]: { ...kGuestRights },
        ...structuredClone(data.roles)
      },
      new AccountRoles({
        roles: Object.keys(data.roles),
        defaultRole: data.defaultRole
      }),
      data.accessRequests
    );
  }

  readonly rights: RightsMap;
  readonly roles: AccountRoles;
  readonly accessRequests: boolean;

  #table: RightsTable;

  private constructor(
    rights: RightsMap,
    roles: AccountRoles,
    accessRequests: boolean
  ) {
    this.rights = rights;
    this.roles = roles;
    this.accessRequests = accessRequests;
    this.#table = new RightsTable(rights, roles.defaultRole);
  }

  canShare(
    role: string
  ): boolean {
    return this.#table.check(role, SHARE_RIGHT) === "write";
  }
}
