// Import Third-party Dependencies
import * as z from "zod";
import { ADMIN_ROLE } from "@jolly-pixel/accounts";
import { AccountRoles } from "@jolly-pixel/accounts/node";
import type { RightsMap } from "@jolly-pixel/network";

// CONSTANTS
const kRights = ["write", "read", "void"] as const;
const kAdminRights = {
  "*": "write"
} as const;
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
  }
} as const satisfies StudioAccessData;

const kAccessSectionSchema = z.object({
  access: z.object({
    defaultRole: z.string().min(1).default(DEFAULT_ACCESS.defaultRole),
    roles: kRolesSchema.default(DEFAULT_ACCESS.roles)
  }).optional()
});

export interface StudioAccessData {
  defaultRole: string;
  roles: RightsMap;
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
    if (Object.hasOwn(data.roles, ADMIN_ROLE)) {
      throw new TypeError(
        `"${source}" declares the built-in "${ADMIN_ROLE}" role`
      );
    }
    if (!Object.hasOwn(data.roles, data.defaultRole)) {
      throw new TypeError(
        `"${source}" has a defaultRole "${data.defaultRole}" that names no role`
      );
    }

    return new StudioAccess(
      {
        [ADMIN_ROLE]: { ...kAdminRights },
        ...structuredClone(data.roles)
      },
      new AccountRoles({
        roles: Object.keys(data.roles),
        defaultRole: data.defaultRole
      })
    );
  }

  readonly rights: RightsMap;
  readonly roles: AccountRoles;

  private constructor(
    rights: RightsMap,
    roles: AccountRoles
  ) {
    this.rights = rights;
    this.roles = roles;
  }
}
