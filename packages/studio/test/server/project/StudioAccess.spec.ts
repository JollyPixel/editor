// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { RightsTable } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  DEFAULT_ACCESS,
  StudioAccess
} from "../../../server/project/StudioAccess.ts";

// CONSTANTS
const kSource = "project.json";

describe("StudioAccess.read", () => {
  test("applies the default roles to a project without an access section", () => {
    const access = StudioAccess.read({ version: 1 }, kSource);

    assert.equal(access.roles.defaultRole, "spectator");
    assert.deepEqual(Object.keys(access.rights), [
      "admin",
      "guest",
      ...Object.keys(DEFAULT_ACCESS.roles)
    ]);
    assert.deepEqual([...access.roles], ["admin", "member", "spectator"]);
    assert.equal(access.accessRequests, false);
  });

  test("reads whether registering without the master password requests access", () => {
    const access = StudioAccess.read({
      access: {
        accessRequests: true
      }
    }, kSource);

    assert.equal(access.accessRequests, true);
    assert.equal(access.roles.defaultRole, "spectator");
  });

  test("reads declared roles and their rule order", () => {
    const access = StudioAccess.read({
      access: {
        defaultRole: "viewer",
        roles: {
          viewer: {
            "*.$join": "write",
            "*": "void"
          }
        }
      }
    }, kSource);

    assert.equal(access.roles.defaultRole, "viewer");
    assert.deepEqual(
      Object.keys(access.rights.viewer),
      ["*.$join", "*"]
    );
    assert.deepEqual([...access.roles], ["admin", "viewer"]);
  });

  test("refuses to let a project declare a built-in role", () => {
    for (const role of ["admin", "guest"]) {
      assert.throws(
        () => StudioAccess.read({
          access: {
            roles: {
              [role]: { "*": "read" },
              spectator: { "*": "read" }
            }
          }
        }, kSource),
        new RegExp(`built-in "${role}" role`)
      );
    }
  });

  for (const { right, allows } of [
    {
      right: "studio.$share",
      allows: (access: StudioAccess, role: string) => access.canShare(role)
    },
    {
      right: "studio.$export",
      allows: (access: StudioAccess, role: string) => access.canExport(role)
    }
  ]) {
    test(`grants ${right} only to roles with write on it`, () => {
      const access = StudioAccess.read({
        access: {
          roles: {
            ...DEFAULT_ACCESS.roles,
            reviewer: {
              [right]: "write",
              "*": "read"
            }
          }
        }
      }, kSource);

      assert.deepEqual(
        ["admin", "member", "reviewer", "spectator", "guest"].filter(
          (role) => allows(access, role)
        ),
        ["admin", "member", "reviewer"]
      );
    });
  }

  test("counts studio.$settings and studio.$audit only for admins and roles naming them", () => {
    const access = StudioAccess.read({
      access: {
        roles: {
          ...DEFAULT_ACCESS.roles,
          reviewer: {
            "studio.$settings": "read",
            "studio.$audit": "write",
            "*": "write"
          }
        }
      }
    }, kSource);
    const roles = ["admin", "member", "reviewer", "spectator", "guest"];

    const rights = roles.map((role) => access.projectRights(role));

    assert.deepEqual(
      rights.map(({ canReadSettings, canEditSettings }) => [canReadSettings, canEditSettings]),
      [[true, true], [false, false], [true, false], [false, false], [false, false]]
    );
    assert.deepEqual(
      roles.filter((_role, index) => rights[index].canAudit),
      ["admin", "reviewer"]
    );
    assert.deepEqual(
      roles.filter((_role, index) => rights[index].canManageAccess),
      ["admin"]
    );
  });

  test("keeps guests out of the catalog and accounts rooms, read-only elsewhere", () => {
    const access = StudioAccess.read({ version: 1 }, kSource);
    const table = new RightsTable(access.rights, access.roles.defaultRole);

    assert.deepEqual(
      [
        "asset-catalog.$join",
        "accounts.$join",
        "asset-catalog-view.$join",
        "voxelmap.$join",
        "voxelmap.$presence",
        "voxelmap.place"
      ].map((key) => table.check("guest", key)),
      ["void", "void", "write", "write", "write", "read"]
    );
  });

  test("refuses a default role that names no declared role", () => {
    for (const defaultRole of ["editor", "admin"]) {
      assert.throws(
        () => StudioAccess.read({
          access: {
            defaultRole,
            roles: {
              member: { "*": "write" }
            }
          }
        }, kSource),
        /names no role/
      );
    }
  });

  test("refuses an unknown right", () => {
    assert.throws(
      () => StudioAccess.read({
        access: {
          roles: {
            spectator: { "*": "admin" }
          }
        }
      }, kSource),
      TypeError
    );
  });
});
