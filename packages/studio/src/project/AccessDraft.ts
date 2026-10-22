// Import Third-party Dependencies
import type { Right } from "@jolly-pixel/network";

// Import Internal Dependencies
import { RoleRules } from "./RoleRules.ts";
import {
  BUILT_IN_ROLES,
  type AccessChange,
  type AccessSection
} from "./routes.ts";

// CONSTANTS
const kNewRoleRules: Readonly<Record<string, Right>> = {
  "*.$join": "write",
  "*.$presence": "write",
  "*": "read"
};

export class AccessDraft {
  static from(
    section: AccessSection
  ): AccessDraft {
    const roles = Object.keys(section.roles);

    return new AccessDraft(
      section,
      new Set(roles),
      new Map(roles.map((role) => [role, role]))
    );
  }

  #section: AccessSection;
  #savedRoles: ReadonlySet<string>;
  #savedNames: ReadonlyMap<string, string>;

  private constructor(
    section: AccessSection,
    savedRoles: ReadonlySet<string>,
    savedNames: ReadonlyMap<string, string>
  ) {
    this.#section = structuredClone(section);
    this.#savedRoles = savedRoles;
    this.#savedNames = savedNames;
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
    const role = this.#availableName(name);

    return this.#with({
      roles: {
        ...this.#section.roles,
        [role]: { ...kNewRoleRules }
      }
    });
  }

  renameRole(
    role: string,
    name: string
  ): AccessDraft {
    if (!Object.hasOwn(this.#section.roles, role)) {
      throw new RangeError(`there is no "${role}" role`);
    }
    if (name.trim() === role) {
      return this;
    }

    const renamed = this.#availableName(name, this.#savedNames.get(role));
    function rename(
      current: string
    ): string {
      return current === role ? renamed : current;
    }

    return this.#with(
      {
        defaultRole: rename(this.#section.defaultRole),
        roles: Object.fromEntries(
          Object.entries(this.#section.roles).map(
            ([current, rules]) => [rename(current), rules]
          )
        )
      },
      new Map(
        [...this.#savedNames].map(
          ([current, saved]) => [rename(current), saved]
        )
      )
    );
  }

  deleteRole(
    role: string
  ): AccessDraft {
    if (role === this.#section.defaultRole) {
      throw new RangeError(`the "${role}" role is the default role`);
    }

    return this.#with(
      {
        roles: Object.fromEntries(
          Object.entries(this.#section.roles).filter(([name]) => name !== role)
        )
      },
      new Map(
        [...this.#savedNames].filter(([current]) => current !== role)
      )
    );
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

  toChange(): AccessChange {
    return {
      access: this.toJSON(),
      renamedRoles: Object.fromEntries(
        [...this.#savedNames]
          .filter(([current, saved]) => current !== saved)
          .map(([current, saved]) => [saved, current])
      )
    };
  }

  #availableName(
    name: string,
    savedName?: string
  ): string {
    const role = name.trim();
    if (role === "") {
      throw new RangeError("a role needs a name");
    }
    if (BUILT_IN_ROLES.includes(role) || Object.hasOwn(this.#section.roles, role)) {
      throw new RangeError(`the "${role}" role already exists`);
    }
    if (role !== savedName && this.#savedRoles.has(role)) {
      throw new RangeError(
        `the saved settings still use the "${role}" role; save before reusing its name`
      );
    }

    return role;
  }

  #with(
    patch: Partial<AccessSection>,
    savedNames = this.#savedNames
  ): AccessDraft {
    return new AccessDraft(
      {
        ...this.#section,
        ...patch
      },
      this.#savedRoles,
      savedNames
    );
  }
}
