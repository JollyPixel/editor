// Import Node.js Dependencies
import { randomUUID } from "node:crypto";
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";
import { readAssetArchive } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { PROJECT_URL_PATH } from "#src/project/api.ts";
import { PROJECT_MANIFEST_FILE } from "#src/project/ProjectManifest.ts";
import { PROJECTS_URL_PATH } from "#src/projects/api.ts";
import { browser } from "#src/testing.ts";
import { testSeed } from "../../helpers/testProject.ts";
import {
  FOLDER_PASSWORD,
  FolderServers,
  listProjects,
  postJson
} from "../../helpers/folderServer.ts";

describe("JollyServer project management", () => {
  let servers: FolderServers;

  before(async() => {
    servers = await FolderServers.create();
  });

  after(async() => {
    await servers.remove();
  });

  test("marks on the projects page the projects that cannot open, for the owner and members", async() => {
    const castleId = randomUUID();
    await using server = await servers.open({
      castle: "open",
      copy: "open",
      terrain: "open"
    }, {
      ids: {
        castle: castleId,
        copy: castleId
      },
      editors: {
        terrain: "terrain"
      }
    });
    const url = await server.listen(0, "127.0.0.1");
    const castleAccounts = new URL(`p/castle${ACCOUNTS_URL_PATH}`, url);
    const alice = browser(castleAccounts);
    await alice.client.register("Alice", FOLDER_PASSWORD);
    const bob = browser(castleAccounts);
    await bob.client.register("Bob", FOLDER_PASSWORD);
    const projectsUrl = new URL(`.${PROJECTS_URL_PATH}`, url);

    const owned = await listProjects(alice, projectsUrl);
    const listed = await listProjects(bob, projectsUrl);
    const terrain = await fetch(new URL("p/terrain/", url));

    assert.deepEqual(owned.map((project) => project.unavailable), [
      null,
      "the project \"copy\" has the same id as the project \"castle\"",
      "the studio build lacks the editors terrain"
    ]);
    assert.deepEqual(listed.map((project) => [project.slug, project.unavailable]), [
      ["castle", null],
      ["copy", "the project \"copy\" has the same id as the project \"castle\""]
    ]);
    assert.equal(terrain.status, 503);
  });

  test("lets only the owner rename and delete projects, keeping a renamed project's members", async() => {
    await using server = await servers.open({
      castle: "open",
      forest: "open"
    });
    const url = await server.listen(0, "127.0.0.1");
    const castleAccounts = new URL(`p/castle${ACCOUNTS_URL_PATH}`, url);
    const alice = browser(castleAccounts);
    await alice.client.register("Alice", FOLDER_PASSWORD);
    const bob = browser(castleAccounts);
    await bob.client.register("Bob", FOLDER_PASSWORD);
    const projectsUrl = new URL(`.${PROJECTS_URL_PATH}`, url);

    const refused = await bob.fetch(new URL("forest", projectsUrl), { method: "DELETE" });
    const renamed = await postJson(alice, new URL("castle/rename", projectsUrl), { slug: "fortress" });
    const taken = await postJson(alice, new URL("fortress/rename", projectsUrl), { slug: "forest" });
    const removed = await alice.fetch(new URL("forest", projectsUrl), { method: "DELETE" });
    const oldPage = await fetch(new URL("p/castle/", url));
    const manifest = await fetch(new URL(`p/fortress/${PROJECT_MANIFEST_FILE}`, url));

    assert.deepEqual(
      [refused.status, renamed.status, taken.status, removed.status],
      [403, 200, 409, 204]
    );
    assert.deepEqual(
      (await listProjects(alice, projectsUrl)).map((project) => project.slug),
      ["fortress"]
    );
    assert.deepEqual(
      (await listProjects(bob, projectsUrl)).map((project) => [project.slug, project.role]),
      [["fortress", "spectator"]]
    );
    assert.equal(oldPage.status, 404);
    assert.equal(manifest.status, 200);
  });

  test("imports an archive as a new project holding only the archive's assets", async() => {
    const seed = await testSeed();
    let archive: Uint8Array<ArrayBuffer>;
    {
      await using source = await servers.open({ castle: "open" });
      const url = await source.listen(0, "127.0.0.1");
      const owner = browser(new URL(`p/castle${ACCOUNTS_URL_PATH}`, url));
      await owner.client.register("Alice", FOLDER_PASSWORD);
      const exported = await owner.fetch(new URL(`p/castle${PROJECT_URL_PATH}archive`, url));
      archive = new Uint8Array(await exported.arrayBuffer());
    }
    const { "models/model.voxelmodel.json": model } = seed;
    assert.ok(model !== undefined && typeof model !== "function");
    await using server = await servers.open({ castle: "open" }, {
      seed: {
        "extra/model.voxelmodel.json": {
          ...model,
          id: "model-extra"
        }
      }
    });
    const url = await server.listen(0, "127.0.0.1");
    const alice = browser(new URL(`p/castle${ACCOUNTS_URL_PATH}`, url));
    await alice.client.register("Alice", FOLDER_PASSWORD);
    const importUrl = new URL(`.${PROJECTS_URL_PATH}restored/import`, url);

    const imported = await alice.fetch(importUrl, {
      method: "POST",
      headers: {
        "content-type": "application/zip"
      },
      body: archive
    });
    const invalid = await alice.fetch(new URL(`.${PROJECTS_URL_PATH}broken/import`, url), {
      method: "POST",
      headers: {
        "content-type": "application/zip"
      },
      body: new Uint8Array([1, 2, 3])
    });
    const restored = await alice.fetch(new URL(`p/restored${PROJECT_URL_PATH}archive`, url));

    assert.deepEqual([imported.status, invalid.status], [201, 400]);
    assert.deepEqual(
      archiveAssetIds(new Uint8Array(await restored.arrayBuffer())),
      archiveAssetIds(archive)
    );
    assert.deepEqual(
      (await listProjects(alice, new URL(`.${PROJECTS_URL_PATH}`, url))).map((project) => project.slug),
      ["castle", "restored"]
    );
  });
});

function archiveAssetIds(
  bytes: Uint8Array
): string[] {
  return readAssetArchive(bytes).unwrap().assets
    .map((asset) => asset.id)
    .sort();
}
