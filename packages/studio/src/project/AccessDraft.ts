// Import Third-party Dependencies
import type { Right } from "@jolly-pixel/network";

// Import Internal Dependencies
import { RoleRules } from "./RoleRules.ts";
import {
  BUILT_IN_ROLES,
  type AccessSection
} from "./routes.ts";

// CONSTANTS
const kNewRoleRules: Readonly<Record<string, Right>> = {
  "*.$join": "write",
  "*.$presence": "write",
  "*": "read"
};

export class AccessDraft {
  #section: AccessSection;

  constructor(
    section: AccessSection
  ) {
    this.#section = structuredClone(section);
  }

  get roles(): string[] {
    return Object.keys(this.#section.roles);
  }

  get defaultRole(): string {
    return this.#section.defaultRole;
  }

  get accessRequests(): boolean {
    return this.#section.accessRequests;
  }

  rules(
    role: string
  ): RoleRules {
    return RoleRules.from(
      Object.hasOwn(this.#section.roles, role) ? this.#section.roles[role] : {}
    );
  }

  withRules(
    role: string,
    rules: RoleRules
  ): AccessDraft {
    return this.#with({
      roles: {
        ...this.#section.roles,
        [role]: rules.toJSON()
      }
    });
  }

  addRole(
    name: string
  ): AccessDraft {
    const role = name.trim();
    if (role === "") {
      throw new RangeError("a role needs a name");
    }
    if (BUILT_IN_ROLES.includes(role) || Object.hasOwn(this.#section.roles, role)) {
      throw new RangeError(`the "${role}" role already exists`);
    }

    return this.#with({
      roles: {
        ...this.#section.roles,
        [role]: { ...kNewRoleRules }
      }
    });
  }

  deleteRole(
    role: string
  ): AccessDraft {
    if (role === this.#section.defaultRole) {
      throw new RangeError(`the "${role}" role is the default role`);
    }

    return this.#with({
      roles: Object.fromEntries(
        Object.entries(this.#section.roles).filter(([name]) => name !== role)
      )
    });
  }

  withDefaultRole(
    role: string
  ): AccessDraft {
    return this.#with({ defaultRole: role });
  }

  withAccessRequests(
    enabled: boolean
  ): AccessDraft {
    return this.#with({ accessRequests: enabled });
  }

  toJSON(): AccessSection {
    return structuredClone(this.#section);
  }

  #with(
    patch: Partial<AccessSection>
  ): AccessDraft {
    return new AccessDraft({
      ...this.#section,
      ...patch
    });
  }
}
