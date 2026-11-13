// Import Node.js Dependencies
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";
import type { AssetBackend } from "@jolly-pixel/asset-server";
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
import type {
  ProjectValueSection,
  StudioProject
} from "./StudioProject.ts";
import {
  settingsSectionSchema,
  type AccessChange,
  type AccessSection,
  type KindOptions,
  type KindPackageSettings,
  type ProjectRight,
  type ProjectSections,
  type ProjectSettingsReply,
  type SettingsSectionBody,
  type SettingsSectionName,
  type SettingsUpdate
} from "../../project/api.ts";
import { KindFilter } from "../../project/KindFilter.ts";
import type { ProjectRights } from "../../project/ProjectRights.ts";
import { InvalidSettingsError } from "./errors/InvalidSettingsError.ts";
import { RoleInUseError } from "./errors/RoleInUseError.ts";
import { StaleSettingsError } from "./errors/StaleSettingsError.ts";

// CONSTANTS
const kRevisionLength = 16;

interface SettingsPlan {
  change: SettingsChange;
  apply(): void;
}

interface SectionHandler<TName extends SettingsSectionName> {
  right: ProjectRight;
  plan(body: SettingsSectionBody<TName>): SettingsPlan | null;
}

type SectionHandlers = {
  [TName in SettingsSectionName]: SectionHandler<TName>;
};

type SettingsBackend = Pick<AssetBackend, "kinds" | "replaceSnapshotPolicy">;

export interface ProjectSettingsOptions {
  project: StudioProject;
  accounts: Accounts;
  /**
   * The policy the accounts were opened with.
   * @default {}
   */
  accountsPolicy?: AccountsPolicy;
  server: Pick<Server, "replaceRights" | "revoke">;
  backend: SettingsBackend;
  audit: AuditLog;
}

export class ProjectSettings {
  #project: StudioProject;
  #accounts: Accounts;
  #accountsPolicy: AccountsPolicy;
  #server: Pick<Server, "replaceRights" | "revoke">;
  #backend: SettingsBackend;
  #audit: AuditLog;
  #writes: Promise<unknown> = Promise.resolve();
  #sections: SectionHandlers = {
    kinds: {
      right: "editSettings",
      plan: (kinds) => this.#planKinds(kinds)
    },
    access: {
      right: "manageAccess",
      plan: (change) => this.#planAccess(change)
    },
    kindFilter: {
      right: "editSettings",
      plan: (kindFilter) => this.#planKindFilter(KindFilter.from(kindFilter))
    },
    game: this.#valueSection("game"),
    physics: this.#valueSection("physics"),
    snapshot: this.#valueSection(
      "snapshot",
      (snapshot) => this.#backend.replaceSnapshotPolicy(snapshot)
    )
  };

  constructor(
    options: ProjectSettingsOptions
  ) {
    this.#project = options.project;
    this.#accounts = options.accounts;
    this.#accountsPolicy = options.accountsPolicy ?? {};
    this.#server = options.server;
    this.#backend = options.backend;
    this.#audit = options.audit;
  }

  get revision(): string {
    return createHash("sha256")
      .update(JSON.stringify(this.#project.file.data))
      .digest("hex")
      .slice(0, kRevisionLength);
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
      revision: this.revision,
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
      physics: this.#project.physics,
      snapshot: this.#project.snapshot
    };
  }

  replace(
    account: Account,
    update: SettingsUpdate
  ): Promise<ProjectSettingsReply> {
    return this.#serialize(account, async() => {
      const rights = this.rights(account);
      const names = settingsSectionSchema.options.filter(
        (name) => update.sections[name] !== undefined
      );
      for (const name of names) {
        rights.require(this.#sections[name].right);
      }
      if (update.revision !== this.revision) {
        throw new StaleSettingsError();
      }

      const plans = names.flatMap(
        (name) => this.#plan(name, update.sections[name]) ?? []
      );
      if (plans.length === 0) {
        return;
      }

      await this.#project.file.replace(Object.fromEntries(
        plans.map(({ change }) => [change.section, change.after])
      ));
      for (const plan of plans) {
        plan.apply();
      }
      for (const plan of plans) {
        await this.#audit.recordSettings(account.id, plan.change);
      }
    });
  }

  #plan<TName extends SettingsSectionName>(
    name: TName,
    body: SettingsSectionBody<TName> | undefined
  ): SettingsPlan | null {
    const handler: SectionHandler<TName> = this.#sections[name];

    return body === undefined ? null : handler.plan(body);
  }

  #valueSection<TName extends ProjectValueSection>(
    section: TName,
    replaced: (value: SettingsSectionBody<TName>) => void = () => undefined
  ): SectionHandler<TName> {
    return {
      right: "editSettings",
      plan: (after) => {
        const before = this.#project[section];

        return isDeepStrictEqual(before, after) ?
          null :
          {
            change: {
              section,
              before,
              after
            },
            apply: () => {
              this.#project.replaceSection(section, after);
              replaced(after);
            }
          };
      }
    };
  }

  #planKindFilter(
    next: KindFilter
  ): SettingsPlan | null {
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
      return null;
    }

    return {
      change: {
        section: "kindFilter",
        before: previous.toJSON(),
        after: next.toJSON()
      },
      apply: () => this.#project.replaceKindFilter(next)
    };
  }

  #planKinds(
    kinds: KindOptions
  ): SettingsPlan | null {
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
      return null;
    }

    return {
      change: {
        section: "kinds",
        before,
        after: Object.fromEntries(
          names.map((name) => [name, kinds[name]])
        )
      },
      apply: () => {
        for (const kindPackage of changed) {
          this.#project.kinds.replace(kindPackage);
          for (const handler of kindPackage.handlers) {
            this.#backend.kinds.replace(handler);
          }
        }
      }
    };
  }

  #planAccess(
    change: AccessChange
  ): SettingsPlan | null {
    const next = invalidAsSettings(
      () => StudioAccess.from(change.access, "access")
    );
    const before = this.#project.access.toJSON();
    const after = next.toJSON();
    if (isDeepStrictEqual(before, after)) {
      return null;
    }
    const renamed = new Map(Object.entries(change.renamedRoles));
    assertRenames(before, after, renamed);
    this.#assertRemovable(before, after, renamed);
    const accountsAccess = invalidAsSettings(
      () => AccountsAccess.resolve(next, this.#accountsPolicy, "access")
    );

    return {
      change: {
        section: "access",
        before,
        after
      },
      apply: () => {
        this.#project.replaceAccess(next);
        this.#server.replaceRights(
          next.rights,
          accountsAccess.roles.defaultRole
        );
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
      }
    };
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
