// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AccountRoles } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import {
  DEFAULT_PHYSICS,
  DEFAULT_PROJECT_SECTIONS
} from "#src/project/ProjectSections.ts";
import { InvalidSettingsError } from "#src/project/node/errors/InvalidSettingsError.ts";
import { settingsHarness } from "../../helpers/settingsHarness.ts";

// CONSTANTS
const kVoxelMapKinds = "@jolly-pixel/asset.voxel-map";

function roleNames(
  roles: AccountRoles
): string[] {
  return [...roles];
}

describe("ProjectSettings", () => {
  test("new kind options reach the handlers and the audit log", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const kinds = Object.fromEntries(
      harness.settings.read(admin).kinds.map(({ name, options }) => [name, options])
    );
    const after = {
      ...kinds,
      [kVoxelMapKinds]: {
        voxelmap: {
          chunkSize: 8
        }
      }
    };

    await harness.update(admin, "kinds", after);

    assert.equal(harness.voxelMapChunkSize(), 8);
    assert.deepEqual(harness.project.file.kinds.get(kVoxelMapKinds), after[kVoxelMapKinds]);
    const [event] = harness.auditedSettings();
    assert.deepEqual(event.actor, { type: "user", id: admin.id });
    assert.deepEqual(event.change, {
      section: "kinds",
      before: kinds,
      after
    });
  });

  test("a new kind filter reaches the project file and the audit log, refusing unknown kinds", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");

    const reply = await harness.update(admin, "kindFilter", {
      hidden: ["voxelmodel", "voxelmap", "voxelmodel"]
    });

    const after = {
      hidden: ["voxelmap", "voxelmodel"]
    };
    assert.deepEqual(reply.kindFilter, after);
    assert.deepEqual(harness.project.file.data.kindFilter, after);
    const [event] = harness.auditedSettings();
    assert.deepEqual(event.change, {
      section: "kindFilter",
      before: {
        hidden: []
      },
      after
    });
    await assert.rejects(
      harness.update(admin, "kindFilter", {
        hidden: ["unknown"]
      }),
      InvalidSettingsError
    );
    assert.deepEqual(harness.settings.sections().kindFilter, after);
  });

  test("new physics settings replace the default in the project file and the audit log", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const after = { ...DEFAULT_PHYSICS, gravity: { x: 0, y: -1.62, z: 0 } };

    await harness.update(admin, "physics", after);

    assert.deepEqual(harness.project.file.data.physics, after);
    const [event] = harness.auditedSettings();
    assert.deepEqual(event.change, {
      section: "physics",
      before: DEFAULT_PHYSICS,
      after
    });
  });

  test("a new snapshot policy reaches the asset backend, the project file and the audit log", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const after = {
      delay: 500,
      maxDelay: 10_000
    };

    await harness.update(admin, "snapshot", after);

    assert.deepEqual(harness.snapshotPolicies, [after]);
    assert.deepEqual(harness.project.file.data.snapshot, after);
    const [event] = harness.auditedSettings();
    assert.deepEqual(event.change, {
      section: "snapshot",
      before: DEFAULT_PROJECT_SECTIONS.snapshot,
      after
    });
  });

  test("a new audit retention reaches the recorder, the project file and the audit log", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const after = {
      keepRowsDays: 365,
      keepVersionsDays: null
    };

    await harness.update(admin, "audit", after);

    assert.deepEqual(harness.retentionPolicies, [after]);
    assert.deepEqual(harness.project.file.data.audit, after);
    assert.deepEqual(harness.auditedSettings().map(({ change }) => change), [{
      section: "audit",
      before: DEFAULT_PROJECT_SECTIONS.audit,
      after
    }]);
  });

  test("new access rules apply at once and reconnect only the holders of a changed role", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const spectator = await harness.register("Bob");
    const { access } = harness.settings.read(admin);
    assert.ok(access !== undefined);

    await harness.update(admin, "access", {
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
    assert.equal(harness.realm.roles.defaultRole, "reviewer");
    assert.deepEqual(roleNames(harness.realm.roles), [
      "admin",
      "member",
      "spectator",
      "reviewer"
    ]);
    assert.equal(harness.project.access.projectRights("spectator").allows("export"), false);
  });

  test("applies a new join mode to the realm", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const { access } = harness.settings.read(admin);
    assert.ok(access !== undefined);

    await harness.update(admin, "access", {
      access: {
        ...access,
        join: "invite"
      },
      renamedRoles: {}
    });

    assert.equal(harness.realm.joinMode, "invite");
  });

  test("a renamed role keeps its accounts, revoked once", async() => {
    await using harness = await settingsHarness();
    const admin = await harness.register("Alice");
    const bob = await harness.register("Bob");
    const { access } = harness.settings.read(admin);
    assert.ok(access !== undefined);
    const accountsRevoked: string[] = [];
    harness.realm.watchRevocations(
      (subject) => accountsRevoked.push(subject)
    );

    await harness.update(admin, "access", {
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

    assert.equal(harness.realm.member(bob.id)?.role, "viewer");
    assert.deepEqual(roleNames(harness.realm.roles), [
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
      harness.update(admin, "access", {
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
    assert.equal(harness.realm.member(bob.id)?.role, "spectator");
  });
});
