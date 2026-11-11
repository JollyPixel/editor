// Import Node.js Dependencies
import { isDeepStrictEqual } from "node:util";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";
import type { AssetKindRegistry } from "@jolly-pixel/asset-server";
import type { KindPackage } from "@jolly-pixel/asset-server/node";
import type { Server } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  AccountsAccess,
  type AccountsPolicy
} from "../accounts/AccountsAccess.ts";
import type { SettingsChange } from "../audit/AuditEntry.ts";
import type { AuditLog } from "../audit/AuditLog.ts";
import { KindOptionSections } from "./KindOptionSections.ts";
import { StudioAccess } from "./StudioAccess.ts";
import type { StudioProject } from "./StudioProject.ts";
import type {
  AccessChange,
  AccessSection,
  KindOptions,
  KindPackageSettings,
  ProjectRight,
  ProjectSections,
  ProjectSettingsReply,
  SettingsSectionBody,
  SettingsSectionName
} from "../../project/api.ts";
import { KindFilter } from "../../project/KindFilter.ts";
import type { ProjectRights } from "../../project/ProjectRights.ts";
import { InvalidSettingsError } from "./errors/InvalidSettingsError.ts";
import { RoleInUseError } from "./errors/RoleInUseError.ts";

interface SectionHandler<TName extends SettingsSectionName> {
  right: ProjectRight;
  replace(actorId: string, body: SettingsSectionBody<TName>): Promise<void>;
}

type SectionHandlers = {
  [TName in SettingsSectionName]: SectionHandler<TName>;
};

export interface ProjectSettingsOptions {
  project: StudioProject;
  accounts: Accounts;
  /**
   * The policy the accounts were opened with.
   * @default {}
   */
  accountsPolicy?: AccountsPolicy;
  server: Pick<Server, "replaceRights" | "revoke">;
  registry: AssetKindRegistry;
  audit: AuditLog;
}

export class ProjectSettings {
  #project: StudioProject;
  #accounts: Accounts;
  #accountsPolicy: AccountsPolicy;
  #server: Pick<Server, "replaceRights" | "revoke">;
  #registry: AssetKindRegistry;
  #audit: AuditLog;
  #writes: Promise<unknown> = Promise.resolve();
  #sections: SectionHandlers = {
    kinds: {
      right: "editSettings",
      replace: (actorId, kinds) => this.#replaceKinds(actorId, kinds)
    },
    access: {
      right: "manageAccess",
      replace: (actorId, change) => this.#replaceAccess(actorId, change)
    },
    kindFilter: {
      right: "editSettings",
      replace: (actorId, kindFilter) => this.#replaceKindFilter(
        actorId,
        KindFilter.from(kindFilter)
      )
    },
    game: this.#valueSection(
      "game",
      (game) => this.#project.replaceGame(game)
    ),
    physics: this.#valueSection(
      "physics",
      (physics) => this.#project.replacePhysics(physics)
    )
  };

  constructor(
    options: ProjectSettingsOptions
  ) {
    this.#project = options.project;
    this.#accounts = options.accounts;
    this.#accountsPolicy = options.accountsPolicy ?? {};
    this.#server = options.server;
    this.#registry = options.registry;
    this.#audit = options.audit;
  }

  rights(
    account: Account
  ): ProjectRights {
    return this.#project.access.projectRights(account.role);
  }

  read(
    account: Account
  ): ProjectSettingsReply {
    const rights = this.rights(account);
    rights.require("readSettings");

    const data: ProjectSettingsReply = {
      name: this.#project.name,
      editors: Array.from(this.#project.editors, (editor) => editor.package),
      kinds: this.#project.kinds.packages.map(
        (kindPackage) => this.#kindPackage(kindPackage)
      ),
      ...this.sections()
    };
    if (rights.allows("manageAccess")) {
      data.access = this.#project.access.toJSON();
    }

    return data;
  }

  sections(): ProjectSections {
    return {
      kindFilter: this.#project.kindFilter.toJSON(),
      game: this.#project.game,
      physics: this.#project.physics
    };
  }

  replace<TName extends SettingsSectionName>(
    account: Account,
    section: TName,
    body: SettingsSectionBody<TName>
  ): Promise<ProjectSettingsReply> {
    const handler: SectionHandler<TName> = this.#sections[section];

    return this.#serialize(account, async() => {
      this.rights(account).require(handler.right);
      await handler.replace(account.id, body);
    });
  }

  #valueSection<TName extends "game" | "physics">(
    section: TName,
    apply: (value: SettingsSectionBody<TName>) => void
  ): SectionHandler<TName> {
    return {
      right: "editSettings",
      replace: async(actorId, after) => {
        const before = this.#project[section];
        if (isDeepStrictEqual(before, after)) {
          return;
        }

        await this.#commit(actorId, {
          section,
          before,
          after
        }, () => apply(after));
      }
    };
  }

  async #replaceKindFilter(
    actorId: string,
    next: KindFilter
  ): Promise<void> {
    const known = new Set(
      this.#project.kinds.descriptors().map((descriptor) => descriptor.kind)
    );
    const unknown = next.hidden.find((kind) => !known.has(kind));
    if (unknown !== undefined) {
      throw new InvalidSettingsError(
        `"${unknown}" is not an asset kind of the project`
      );
    }
    const previous = this.#project.kindFilter;
    if (next.equals(previous)) {
      return;
    }

    await this.#commit(actorId, {
      section: "kindFilter",
      before: previous.toJSON(),
      after: next.toJSON()
    }, () => this.#project.replaceKindFilter(next));
  }

  async #replaceKinds(
    actorId: string,
    kinds: KindOptions
  ): Promise<void> {
    const before = this.#kindOptions();
    const names = Object.keys(before);
    if (!isDeepStrictEqual(Object.keys(kinds).sort(), [...names].sort())) {
      throw new InvalidSettingsError(
        "kind packages are added and removed in the project file"
      );
    }

    const changed: KindPackage[] = [];
    for (const kindPackage of this.#project.kinds.packages) {
      const options = kinds[kindPackage.name];
      if (!isDeepStrictEqual(options, kindPackage.options)) {
        changed.push(invalidAsSettings(() => kindPackage.withOptions(options)));
      }
    }
    if (changed.length === 0) {
      return;
    }

    const after = Object.fromEntries(
      names.map((name) => [name, kinds[name]])
    );
    await this.#commit(actorId, {
      section: "kinds",
      before,
      after
    }, () => {
      for (const kindPackage of changed) {
        this.#project.kinds.replace(kindPackage);
        for (const handler of kindPackage.handlers) {
          this.#registry.replace(handler);
        }
      }
    });
  }

  async #replaceAccess(
    actorId: string,
    change: AccessChange
  ): Promise<void> {
    const next = invalidAsSettings(
      () => StudioAccess.from(change.access, "access")
    );
    const before = this.#project.access.toJSON();
    const after = next.toJSON();
    if (isDeepStrictEqual(before, after)) {
      return;
    }
    const renamed = new Map(Object.entries(change.renamedRoles));
    assertRenames(before, after, renamed);
    this.#assertRemovable(before, after, renamed);
    const accountsAccess = invalidAsSettings(
      () => AccountsAccess.resolve(next, this.#accountsPolicy, "access")
    );

    await this.#commit(actorId, {
      section: "access",
      before,
      after
    }, () => {
      this.#project.replaceAccess(next);
      this.#server.replaceRights(next.rights, accountsAccess.roles.defaultRole);
      accountsAccess.applyTo(this.#accounts, renamed);
      const moved = new Set(renamed.values());
      for (const role of Object.keys(after.roles)) {
        if (
          !moved.has(role) &&
          !isDeepStrictEqual(before.roles[role], after.roles[role])
        ) {
          for (const accountId of this.#accounts.holders(role)) {
            this.#server.revoke(accountId);
          }
        }
      }
    });
  }

  #assertRemovable(
    before: AccessSection,
    after: AccessSection,
    renamed: ReadonlyMap<string, string>
  ): void {
    for (const role of Object.keys(before.roles)) {
      if (Object.hasOwn(after.roles, role)) {
        continue;
      }
      if (!renamed.has(role) && this.#accounts.holders(role).length > 0) {
        throw new RoleInUseError(role, "an account holds it");
      }
      if (this.#accountsPolicy.defaultRole === role) {
        throw new RoleInUseError(role, "new accounts get it");
      }
    }
  }

  #kindOptions(): KindOptions {
    return Object.fromEntries(
      this.#project.kinds.packages.map(
        (kindPackage) => [kindPackage.name, structuredClone(kindPackage.options)]
      )
    );
  }

  async #commit(
    actorId: string,
    change: SettingsChange,
    apply: () => void
  ): Promise<void> {
    await this.#project.file.replace(change.section, change.after);
    apply();
    await this.#audit.recordSettings(actorId, change);
  }

  async #serialize(
    account: Account,
    task: () => Promise<void>
  ): Promise<ProjectSettingsReply> {
    const run = this.#writes.then(task);
    this.#writes = run.catch(() => undefined);
    await run;

    return this.read(account);
  }

  #kindPackage(
    kindPackage: KindPackage
  ): KindPackageSettings {
    return {
      name: kindPackage.name,
      options: structuredClone(kindPackage.options),
      sections: [...KindOptionSections.read(
        kindPackage.optionsSchema,
        kindPackage.descriptors
      )]
    };
  }
}

function assertRenames(
  before: AccessSection,
  after: AccessSection,
  renamed: ReadonlyMap<string, string>
): void {
  if (new Set(renamed.values()).size !== renamed.size) {
    throw new InvalidSettingsError("two roles cannot take the same name");
  }
  for (const [from, to] of renamed) {
    const valid = Object.hasOwn(before.roles, from) &&
      !Object.hasOwn(after.roles, from) &&
      Object.hasOwn(after.roles, to) &&
      !Object.hasOwn(before.roles, to);
    if (!valid) {
      throw new InvalidSettingsError(
        `the "${from}" role cannot be renamed to "${to}"`
      );
    }
  }
}

function invalidAsSettings<T>(
  parse: () => T
): T {
  try {
    return parse();
  }
  catch (error) {
    if (error instanceof TypeError) {
      throw new InvalidSettingsError(error.message, { cause: error });
    }

    throw error;
  }
}
