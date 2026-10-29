// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import {
  Accounts,
  type AccountRoles
} from "@jolly-pixel/accounts/node";
import { AssetServer } from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import {
  AuditLog,
  SETTINGS_CHANGED
} from "../../../server/audit/AuditLog.ts";
import { ProjectSettings } from "../../../server/project/ProjectSettings.ts";
import {
  STUDIO_ROOT,
  StudioProject
} from "../../../server/project/StudioProject.ts";
import { KindOptionsDraft } from "../../../src/project/KindOptionsDraft.ts";
import { InvalidSettingsError } from "../../../server/project/errors/InvalidSettingsError.ts";

// CONSTANTS
const kPassword = "p".repeat(43);
const kVoxelModelKinds = "@jolly-pixel/asset.voxel-model";

interface SettingsHarness extends AsyncDisposable {
  settings: ProjectSettings;
  project: StudioProject;
  accounts: Accounts;
  audit: AuditLog;
  handlerDelay(kind: string): number | undefined;
  revoked: string[];
  register(username: string): Promise<Account>;
}

async function settingsHarness(): Promise<SettingsHarness> {
  const project = await StudioProject.open(
    StudioProject.resolveRoot(STUDIO_ROOT, {}),
    { inMemory: true }
  );
  const accounts = await Accounts.open({
    roles: project.access.roles
  });
  const assetServer = await AssetServer.open({
    root: project.file.root,
    inMemory: true,
    handlers: project.kinds.handlers(),
    rights: project.access.rights,
    defaultRole: accounts.roles.defaultRole,
    auth: accounts
  });
  const audit = await AuditLog.open(null);
  const revoked: string[] = [];

  return {
    project,
    accounts,
    audit,
    revoked,
    settings: new ProjectSettings({
      project,
      accounts,
      server: {
        replaceRights: (rights, defaultRole) => assetServer.network.replaceRights(
          rights,
          defaultRole
        ),
        revoke: (subject) => {
          revoked.push(subject);
          assetServer.network.revoke(subject);
        }
      },
      registry: assetServer.backend.kinds,
      audit
    }),
    handlerDelay: (kind) => assetServer.backend.kinds.get(kind).snapshot?.delay,
    async register(username) {
      const registration = await accounts.register({
        username,
        password: kPassword
      }, {
        address: "203.0.113.7",
        secure: false,
        headers: {}
      });
      assert.ok(registration.status === "active");

      return registration.account;
    },
    async [Symbol.asyncDispose]() {
      await assetServer.close();
      await audit[Symbol.asyncDispose]();
      accounts[Symbol.dispose]();
    }
  };
}

function roleNames(
  roles: AccountRoles
): string[] {
  return [...roles];
}

describe("ProjectSettings", () => {
  test("new kind options reach the handlers and the audit log", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const kinds = KindOptionsDraft.from(harness.settings.read(admin).kinds).toJSON();
    const after = {
      ...kinds,
      [kVoxelModelKinds]: {
        snapshot: {
          delay: 500,
          maxDelay: 30_000
        }
      }
    };

    await harness.settings.replaceKinds(admin, after);

    assert.equal(harness.handlerDelay("voxelmodel"), 500);
    assert.deepEqual(harness.project.file.kinds.get(kVoxelModelKinds), after[kVoxelModelKinds]);
    const [event] = await harness.audit.store.reader.listAll();
    assert.equal(event.eventType, SETTINGS_CHANGED);
    assert.deepEqual(event.actor, { type: "user", id: admin.id });
    assert.deepEqual(event.eventData, {
      section: "kinds",
      before: kinds,
      after
    });
  });

  test("a new kind filter reaches the project file and the audit log, refusing unknown kinds", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");

    const reply = await harness.settings.replaceKindFilter(admin, {
      hidden: ["voxelmodel", "voxelmap", "voxelmodel"]
    });

    const after = {
      hidden: ["voxelmap", "voxelmodel"]
    };
    assert.deepEqual(reply.kindFilter, after);
    assert.deepEqual(harness.project.file.data.kindFilter, after);
    const [event] = await harness.audit.store.reader.listAll();
    assert.deepEqual(event.eventData, {
      section: "kindFilter",
      before: {
        hidden: []
      },
      after
    });
    await assert.rejects(
      harness.settings.replaceKindFilter(admin, {
        hidden: ["unknown"]
      }),
      InvalidSettingsError
    );
    assert.deepEqual(harness.settings.kindFilter(), after);
  });

  test("new access rules apply at once and reconnect only the holders of a changed role", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const spectator = await harness.register("Bob");
    const { access } = harness.settings.read(admin);
    assert.ok(access !== undefined);

    await harness.settings.replaceAccess(admin, {
      access: {
        ...access,
        defaultRole: "reviewer",
        roles: {
          ...access.roles,
          spectator: {
            "*": "void"
          },
          reviewer: {
            "*": "read"
          }
        }
      },
      renamedRoles: {}
    });

    assert.deepEqual(harness.revoked, [spectator.id]);
    assert.equal(harness.accounts.roles.defaultRole, "reviewer");
    assert.deepEqual(roleNames(harness.accounts.roles), [
      "admin",
      "member",
      "spectator",
      "reviewer"
    ]);
    assert.equal(harness.project.access.projectRights("spectator").allows("export"), false);
  });

  test("refuses access requests without a master password and leaves the access unchanged", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const { access } = harness.settings.read(admin);
    assert.ok(access !== undefined);

    await assert.rejects(
      harness.settings.replaceAccess(admin, {
        access: {
          ...access,
          accessRequests: true
        },
        renamedRoles: {}
      }),
      InvalidSettingsError
    );
    assert.deepEqual(harness.project.access.toJSON(), access);
    assert.deepEqual(await harness.audit.store.reader.listAll(), []);
  });

  test("a renamed role keeps its accounts, revoked once", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const bob = await harness.register("Bob");
    const { access } = harness.settings.read(admin);
    assert.ok(access !== undefined);
    const accountsRevoked: string[] = [];
    harness.accounts.watchRevocations(
      (subject) => accountsRevoked.push(subject)
    );

    await harness.settings.replaceAccess(admin, {
      access: {
        ...access,
        defaultRole: "viewer",
        roles: {
          member: access.roles.member,
          viewer: access.roles.spectator
        }
      },
      renamedRoles: {
        spectator: "viewer"
      }
    });

    assert.equal(harness.accounts.account(bob.id)?.role, "viewer");
    assert.deepEqual(roleNames(harness.accounts.roles), [
      "admin",
      "member",
      "viewer"
    ]);
    assert.deepEqual(accountsRevoked, [bob.id]);
    assert.deepEqual(harness.revoked, []);
  });

  test("refuses a rename onto a role that already existed", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const bob = await harness.register("Bob");
    const { access } = harness.settings.read(admin);
    assert.ok(access !== undefined);

    await assert.rejects(
      harness.settings.replaceAccess(admin, {
        access: {
          ...access,
          roles: {
            member: access.roles.member
          },
          defaultRole: "member"
        },
        renamedRoles: {
          spectator: "member"
        }
      }),
      InvalidSettingsError
    );
    assert.deepEqual(harness.project.access.toJSON(), access);
    assert.equal(harness.accounts.account(bob.id)?.role, "spectator");
  });
});
