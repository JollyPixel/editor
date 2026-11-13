// Import Third-party Dependencies
import {
  ADMIN_ROLE,
  GUEST_ROLE
} from "@jolly-pixel/accounts";
import { BUILT_IN_ROLES } from "@jolly-pixel/server";

// Import Internal Dependencies
import type { AccessDraft } from "./AccessDraft.ts";

// CONSTANTS
const kBuiltInDescriptions: Readonly<Record<string, string>> = {
  [ADMIN_ROLE]: "Writes everything and manages the project. Built in.",
  [GUEST_ROLE]: "Opens a share link: reads the shared asset only. Built in."
};

export interface RoleHolder {
  readonly role: string;
}

export interface RoleSummary {
  readonly name: string;
  readonly builtIn: boolean;
  readonly description: string | undefined;
  readonly heldAs: string | null;
  readonly members: number | null;
  readonly isDefault: boolean;
  readonly deleteBlocker: string | null;
}

export function roleSummaries(
  draft: AccessDraft,
  accounts: Iterable<RoleHolder>
): RoleSummary[] {
  const counts = new Map<string, number>();
  for (const { role } of accounts) {
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  function countMembers(
    heldAs: string | null
  ): number | null {
    return heldAs === null ? null : counts.get(heldAs) ?? 0;
  }

  return [
    ...BUILT_IN_ROLES.map((name) => {
      const heldAs = name === ADMIN_ROLE ? name : null;

      return {
        name,
        builtIn: true,
        description: kBuiltInDescriptions[name],
        heldAs,
        members: countMembers(heldAs),
        isDefault: false,
        deleteBlocker: "Built in"
      };
    }),
    ...draft.roles.map((name) => {
      const heldAs = draft.savedName(name);
      const members = countMembers(heldAs);
      const isDefault = name === draft.defaultRole;

      return {
        name,
        builtIn: false,
        description: undefined,
        heldAs,
        members,
        isDefault,
        deleteBlocker: deleteBlocker(isDefault, members ?? 0)
      };
    })
  ];
}

function deleteBlocker(
  isDefault: boolean,
  members: number
): string | null {
  if (isDefault) {
    return "New accounts get this role";
  }
  if (members > 0) {
    return members === 1 ?
      "An account holds this role" :
      `${members} accounts hold this role`;
  }

  return null;
}
