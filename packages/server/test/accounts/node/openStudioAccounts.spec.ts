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
import { EditorPackages } from "#src/editors/node/EditorPackages.ts";
import {
  openProjectRealm,
  openStudioAccounts
} from "#src/accounts/node/openStudioAccounts.ts";
import { StudioProject } from "#src/project/node/StudioProject.ts";

// CONSTANTS
const kAccessRequests = {
  access: {
    accessRequests: true
  }
};
const kDigest = "p".repeat(43);
const kRequester = {
  address: "203.0.113.7",
  secure: false,
  headers: {}
};

function project(
  root: string,
  document: Record<string, unknown> = {}
): StudioProject {
  return new StudioProject(
    new ProjectFile(root, {
      ...document,
      version: 1
    }),
    new EditorPackages([]),
    new ProjectKinds([], new PackageResolver(root))
  );
}

describe("openProjectRealm", () => {
  test("takes the roles and the default role of the project", async() => {
    using accounts = await openStudioAccounts(
      project(path.resolve("/studio")),
      { inMemory: true }
    );
    const realm = openProjectRealm(accounts, project(path.resolve("/studio")));

    assert.deepEqual([...realm.roles], ["admin", "member", "spectator"]);
    assert.equal(realm.roles.defaultRole, "spectator");
  });

  test("lets the host override the role of new accounts", async() => {
    using accounts = await openStudioAccounts(
      project(path.resolve("/studio")),
      { inMemory: true }
    );
    const realm = openProjectRealm(
      accounts,
      project(path.resolve("/studio")),
      { defaultRole: "member" }
    );

    assert.deepEqual([...realm.roles], ["admin", "member", "spectator"]);
    assert.equal(realm.roles.defaultRole, "member");
  });

  test("holds later registrations for approval when the project takes access requests", async() => {
    const studio = project(path.resolve("/studio"), kAccessRequests);
    using accounts = await openStudioAccounts(studio, { inMemory: true });
    const realm = openProjectRealm(accounts, studio);

    const owner = await realm.register({
      username: "Alice",
      password: kDigest
    }, kRequester);
    const requester = await realm.register({
      username: "Bob",
      password: kDigest
    }, kRequester);

    assert.equal(realm.join, "request");
    assert.deepEqual(
      [owner.status, requester.status],
      ["active", "pending"]
    );
  });
});

describe("openStudioAccounts", () => {
  test("warns that registration is open while no master password is set", async() => {
    const warnings: string[] = [];
    const logger = {
      warn: (message: string) => warnings.push(message)
    };

    using _open = await openStudioAccounts(
      project(path.resolve("/studio")),
      {
        inMemory: true,
        masterPassword: "",
        logger
      }
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /JOLLY_MASTER_PASSWORD is not set/);

    using _guarded = await openStudioAccounts(
      project(path.resolve("/studio")),
      {
        inMemory: true,
        masterPassword: "open sesame",
        logger
      }
    );
    assert.equal(warnings.length, 1);
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
