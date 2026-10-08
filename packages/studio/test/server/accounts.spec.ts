// Import Node.js Dependencies
import path from "node:path";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  PackageResolver,
  ProjectFile,
  ProjectKinds
} from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import { EditorPackages } from "../../server/EditorPackages.ts";
import { StudioAccess } from "../../server/StudioAccess.ts";
import { openStudioAccounts } from "../../server/accounts.ts";
import { StudioProject } from "../../server/StudioProject.ts";

function project(
  root: string,
  document: Record<string, unknown> = {}
): StudioProject {
  return new StudioProject(
    new ProjectFile(root, {
      version: 1
    }),
    new EditorPackages([]),
    new ProjectKinds([], new PackageResolver(root)),
    StudioAccess.read(document, "project.json")
  );
}

describe("openStudioAccounts", () => {
  test("takes the roles and the default role of the project", async() => {
    using accounts = await openStudioAccounts(
      project(path.resolve("/studio")),
      { inMemory: true }
    );

    assert.deepEqual([...accounts.roles], ["admin", "member", "spectator"]);
    assert.equal(accounts.roles.defaultRole, "spectator");
  });

  test("lets the host override the role of new accounts", async() => {
    using accounts = await openStudioAccounts(
      project(path.resolve("/studio")),
      {
        inMemory: true,
        defaultRole: "member"
      }
    );

    assert.deepEqual([...accounts.roles], ["admin", "member", "spectator"]);
    assert.equal(accounts.roles.defaultRole, "member");
  });

  test("names the session cookie after the project root", async() => {
    using first = await openStudioAccounts(
      project(path.resolve("/studio/a")),
      { inMemory: true }
    );
    using again = await openStudioAccounts(
      project(path.resolve("/studio/a")),
      { inMemory: true }
    );
    using other = await openStudioAccounts(
      project(path.resolve("/studio/b")),
      { inMemory: true }
    );

    assert.match(first.cookie.name, /^jolly_session_[0-9a-f]{12}$/);
    assert.equal(first.cookie.name, again.cookie.name);
    assert.notEqual(first.cookie.name, other.cookie.name);
  });
});
