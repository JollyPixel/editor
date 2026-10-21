// Import Node.js Dependencies
import { isDeepStrictEqual } from "node:util";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";
import type { AssetKindRegistry } from "@jolly-pixel/asset-server";
import type { KindPackage } from "@jolly-pixel/asset-server/node";
import type { Server } from "@jolly-pixel/network";

// Import Internal Dependencies
import { AccountsAccess } from "../AccountsAccess.ts";
import type { StudioAccountsOptions } from "../accounts.ts";
import type { AuditLog } from "../audit/AuditLog.ts";
import { KindOptionSections } from "./KindOptionSections.ts";
import { StudioAccess } from "./StudioAccess.ts";
import type { StudioProject } from "./StudioProject.ts";
import {
  ACCESS_SECTION,
  KINDS_SECTION,
  type AccessSection,
  type KindOptions,
  type KindPackageSettings,
  type ProjectReply,
  type ProjectSettingsReply
} from "../../src/project/routes.ts";
import { InvalidSettingsError } from "./errors/InvalidSettingsError.ts";
import { RoleInUseError } from "./errors/RoleInUseError.ts";
import { SettingsRefusedError } from "./errors/SettingsRefusedError.ts";

export interface ProjectSettingsOptions {
  project: StudioProject;
  accounts: Accounts;
  /**
   * The options the accounts were opened with, which override the role of
   * new accounts and hold the master password.
   * @default {}
   */
  accountsOptions?: StudioAccountsOptions;
  server: Pick<Server, "replaceRights" | "revoke">;
  registry: AssetKindRegistry;
  audit: AuditLog;
}

export class ProjectSettings {
  #project: StudioProject;
  #accounts: Accounts;
  #accountsOptions: StudioAccountsOptions;
  #server: Pick<Server, "replaceRights" | "revoke">;
  #registry: AssetKindRegistry;
  #audit: AuditLog;
  #writes: Promise<unknown> = Promise.resolve();

  constructor(
    options: ProjectSettingsOptions
  ) {
    this.#project = options.project;
    this.#accounts = options.accounts;
    this.#accountsOptions = options.accountsOptions ?? {};
    this.#server = options.server;
    this.#registry = options.registry;
    this.#audit = options.audit;
  }

  rights(
    account: Account
  ): ProjectReply {
    return this.#project.access.projectRights(account.role);
  }

  read(
    account: Account
  ): ProjectSettingsReply {
    const rights = this.rights(account);
    if (!rights.canReadSettings) {
      throw new SettingsRefusedError("this role cannot read the project settings");
    }

    const data: ProjectSettingsReply = {
      name: this.#project.name,
      editors: Array.from(this.#project.editors, (editor) => editor.package),
      kinds: this.#project.kinds.packages.map(
        (kindPackage) => this.#kindPackage(kindPackage)
      )
    };
    if (rights.canManageAccess) {
      data.access = this.#project.access.toJSON();
    }

    return data;
  }

  replaceKinds(
    account: Account,
    kinds: KindOptions
  ): Promise<ProjectSettingsReply> {
    return this.#serialize(account, async() => {
      if (!this.rights(account).canEditSettings) {
        throw new SettingsRefusedError("this role cannot change the project settings");
      }
      await this.#replaceKinds(account.id, kinds);
    });
  }

  replaceAccess(
    account: Account,
    access: AccessSection
  ): Promise<ProjectSettingsReply> {
    return this.#serialize(account, async() => {
      if (!this.rights(account).canManageAccess) {
        throw new SettingsRefusedError("only an admin changes the access settings");
      }
      await this.#replaceAccess(account.id, access);
    });
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
    await this.#project.file.replace(KINDS_SECTION, after);
    for (const kindPackage of changed) {
      this.#project.kinds.replace(kindPackage);
      for (const handler of kindPackage.handlers) {
        this.#registry.replace(handler);
      }
    }
    this.#audit.recordSettings(actorId, {
      section: KINDS_SECTION,
      before,
      after
    });
  }

  async #replaceAccess(
    actorId: string,
    section: AccessSection
  ): Promise<void> {
    const next = invalidAsSettings(
      () => StudioAccess.from(section, ACCESS_SECTION)
    );
    const before = this.#project.access.toJSON();
    const after = next.toJSON();
    if (isDeepStrictEqual(before, after)) {
      return;
    }
    this.#assertRemovable(before, after);
    const accountsAccess = invalidAsSettings(
      () => AccountsAccess.resolve(next, this.#accountsOptions, ACCESS_SECTION)
    );

    await this.#project.file.replace(ACCESS_SECTION, after);
    this.#project.replaceAccess(next);
    this.#server.replaceRights(next.rights, accountsAccess.roles.defaultRole);
    accountsAccess.applyTo(this.#accounts);
    for (const role of Object.keys(after.roles)) {
      if (!isDeepStrictEqual(before.roles[role], after.roles[role])) {
        for (const accountId of this.#accounts.holders(role)) {
          this.#server.revoke(accountId);
        }
      }
    }
    this.#audit.recordSettings(actorId, {
      section: ACCESS_SECTION,
      before,
      after
    });
  }

  #assertRemovable(
    before: AccessSection,
    after: AccessSection
  ): void {
    for (const role of Object.keys(before.roles)) {
      if (Object.hasOwn(after.roles, role)) {
        continue;
      }
      if (this.#accounts.holders(role).length > 0) {
        throw new RoleInUseError(role, "an account holds it");
      }
      if (this.#accountsOptions.defaultRole === role) {
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
