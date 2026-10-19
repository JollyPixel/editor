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
import { createAssetWorkspace } from "@jolly-pixel/asset-server/node";

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
  const workspace = await createAssetWorkspace({
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
        replaceRights: (rights, defaultRole) => workspace.server.replaceRights(
          rights,
          defaultRole
        ),
        revoke: (subject) => {
          revoked.push(subject);
          workspace.server.revoke(subject);
        }
      },
      registry: workspace.backend.kinds,
      audit
    }),
    handlerDelay: (kind) => workspace.backend.kinds.get(kind).snapshot?.delay,
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
      await workspace.close();
      audit[Symbol.dispose]();
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
    const [event] = harness.audit.store.reader.listAll();
    assert.equal(event.eventType, SETTINGS_CHANGED);
    assert.deepEqual(event.actor, { type: "user", id: admin.id });
    assert.deepEqual(event.eventData, {
      section: "kinds",
      before: kinds,
      after
    });
  });

  test("new access rules apply at once and reconnect only the holders of a changed role", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const spectator = await harness.register("Bob");
    const { access } = harness.settings.read(admin);
    assert.ok(access !== undefined);

    await harness.settings.replaceAccess(admin, {
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
    });

    assert.deepEqual(harness.revoked, [spectator.id]);
    assert.equal(harness.accounts.roles.defaultRole, "reviewer");
    assert.deepEqual(roleNames(harness.accounts.roles), [
      "admin",
      "member",
      "spectator",
      "reviewer"
    ]);
    assert.equal(harness.project.access.canExport("spectator"), false);
  });

  test("refuses access requests without a master password and leaves the access unchanged", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const { access } = harness.settings.read(admin);
    assert.ok(access !== undefined);

    await assert.rejects(
      harness.settings.replaceAccess(admin, {
        ...access,
        accessRequests: true
      }),
      InvalidSettingsError
    );
    assert.deepEqual(harness.project.access.toJSON(), access);
    assert.deepEqual(harness.audit.store.reader.listAll(), []);
  });
});
