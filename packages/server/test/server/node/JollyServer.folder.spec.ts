// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ACCOUNTS_URL_PATH,
  AccountsClient,
  Username,
  prehashPassword,
  type AccountsRequestError
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { PROJECT_MANIFEST_FILE } from "#src/project/ProjectManifest.ts";
import { PROJECTS_URL_PATH } from "#src/projects/api.ts";
import { browser } from "#src/testing.ts";
import {
  PUBLIC_HOST,
  SHELL_HTML,
  requestUpgrade
} from "../../helpers/jollyServer.ts";
import {
  FOLDER_PASSWORD,
  FolderServers,
  listProjects,
  postJson
} from "../../helpers/folderServer.ts";

describe("JollyServer over a projects folder", () => {
  let servers: FolderServers;

  before(async() => {
    servers = await FolderServers.create();
  });

  after(async() => {
    await servers.remove();
  });

  test("serves each project of a folder under its slug", async() => {
    await using server = await servers.open({
      castle: "open",
      forest: "open"
    });
    const url = await server.listen(0, "127.0.0.1");

    const bare = await fetch(new URL("p/castle", url), { redirect: "manual" });
    const shellPage = await fetch(new URL("p/castle/", url));
    const manifest = await fetch(new URL(`p/forest/${PROJECT_MANIFEST_FILE}`, url));
    const unknown = await fetch(new URL("p/moon/", url));
    const upgrade = await requestUpgrade(new URL("p/castle/", url), PUBLIC_HOST);
    upgrade.socket?.destroy();

    assert.equal(bare.status, 308);
    assert.equal(bare.headers.get("location"), "/p/castle/");
    assert.equal(await shellPage.text(), SHELL_HTML);
    assert.equal(manifest.status, 200);
    assert.equal(unknown.status, 404);
    assert.equal(upgrade.status, 101);
  });

  test("signs an account in once and lets it join another project in place", async() => {
    await using server = await servers.open({
      castle: "open",
      forest: "open",
      keep: "invite"
    });
    const url = await server.listen(0, "127.0.0.1");
    const castleAccounts = new URL(`p/castle${ACCOUNTS_URL_PATH}`, url);
    await browser(castleAccounts).client.register("Alice", FOLDER_PASSWORD);
    const bob = browser(castleAccounts);
    await bob.client.register("Bob", FOLDER_PASSWORD);
    const forest = new AccountsClient({
      url: new URL(`p/forest${ACCOUNTS_URL_PATH}`, url),
      fetch: bob.fetch
    });
    const keep = new AccountsClient({
      url: new URL(`p/keep${ACCOUNTS_URL_PATH}`, url),
      fetch: bob.fetch
    });

    await assert.rejects(
      forest.me(),
      (error: AccountsRequestError) => error.code === "membership-required"
    );
    const joined = await forest.join();
    assert.ok(joined.status === "active");

    assert.equal(joined.account.username, "Bob");
    assert.equal((await forest.me())?.username, "Bob");
    await assert.rejects(
      keep.join(),
      (error: AccountsRequestError) => error.code === "invitation-required"
    );
  });
  test("lists each account's projects and lets the owner create one", async() => {
    await using server = await servers.open({
      castle: "open",
      forest: "request"
    });
    const url = await server.listen(0, "127.0.0.1");
    const castleAccounts = new URL(`p/castle${ACCOUNTS_URL_PATH}`, url);
    const alice = browser(castleAccounts);
    await alice.client.register("Alice", FOLDER_PASSWORD);
    const bob = browser(castleAccounts);
    await bob.client.register("Bob", FOLDER_PASSWORD);
    await new AccountsClient({
      url: new URL(`p/forest${ACCOUNTS_URL_PATH}`, url),
      fetch: bob.fetch
    }).join();
    const projectsUrl = new URL(`.${PROJECTS_URL_PATH}`, url);

    const home = await fetch(url, { redirect: "manual" });
    const signedOut = await fetch(projectsUrl);
    const created = await postJson(alice, projectsUrl, { slug: "moon" });
    const refused = await postJson(bob, projectsUrl, { slug: "sun" });
    const owned = await listProjects(alice, projectsUrl);
    const listed = await listProjects(bob, projectsUrl);
    const moon = await fetch(new URL(`p/moon/${PROJECT_MANIFEST_FILE}`, url));

    assert.equal(home.status, 302);
    assert.equal(home.headers.get("location"), "/projects/");
    assert.equal(signedOut.status, 401);
    assert.deepEqual([created.status, refused.status], [201, 403]);
    assert.deepEqual(owned.map((project) => project.slug), ["castle", "forest", "moon"]);
    assert.deepEqual(listed, [
      {
        slug: "castle",
        role: "spectator",
        pending: false,
        unavailable: null
      },
      {
        slug: "forest",
        role: null,
        pending: true,
        unavailable: null
      }
    ]);
    assert.equal(moon.status, 200);
  });

  test("signs an account in at the root for the projects page", async() => {
    await using server = await servers.open({
      castle: "open"
    });
    const url = await server.listen(0, "127.0.0.1");
    await browser(new URL(`p/castle${ACCOUNTS_URL_PATH}`, url))
      .client.register("Alice", FOLDER_PASSWORD);
    const visitor = browser(new URL(`.${ACCOUNTS_URL_PATH}`, url));

    const signIn = await postJson(
      visitor,
      new URL(`.${ACCOUNTS_URL_PATH}login`, url),
      {
        username: "Alice",
        password: await prehashPassword(Username.parse("Alice"), FOLDER_PASSWORD)
      }
    );
    const projects = await listProjects(visitor, new URL(`.${PROJECTS_URL_PATH}`, url));

    assert.equal(signIn.status, 200);
    assert.deepEqual(projects.map((project) => project.slug), ["castle"]);
  });
});
