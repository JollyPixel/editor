// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  DEFAULT_ACCESS,
  StudioAccess
} from "../../server/StudioAccess.ts";

// CONSTANTS
const kSource = "project.json";

describe("StudioAccess.read", () => {
  test("applies the default roles to a project without an access section", () => {
    const access = StudioAccess.read({ version: 1 }, kSource);

    assert.equal(access.roles.defaultRole, "spectator");
    assert.deepEqual(access.rights, {
      admin: { "*": "write" },
      ...DEFAULT_ACCESS.roles
    });
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
        defaultRole: "guest",
        roles: {
          guest: {
            "*.$join": "write",
            "*": "void"
          }
        }
      }
    }, kSource);

    assert.equal(access.roles.defaultRole, "guest");
    assert.deepEqual(
      Object.keys(access.rights.guest),
      ["*.$join", "*"]
    );
    assert.deepEqual([...access.roles], ["admin", "guest"]);
  });

  test("refuses to let a project declare the built-in admin role", () => {
    assert.throws(
      () => StudioAccess.read({
        access: {
          roles: {
            admin: { "*": "read" },
            spectator: { "*": "read" }
          }
        }
      }, kSource),
      /built-in "admin" role/
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
