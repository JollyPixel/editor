// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { NO_SHELL_PREFERENCES } from "#src/preferences/PreferenceScopes.ts";
import { PROJECT_MANIFEST_FILE } from "#src/project/ProjectManifest.ts";
import { VIEW_PAGES_PREFIX } from "#src/shares/api.ts";
import { JollyServer } from "#src/server/node/JollyServer.ts";
import { ProjectHosting } from "#src/projects/node/ProjectHosting.ts";
import {
  browser,
  createDist,
  voxelMapProject
} from "#src/testing.ts";
import { testSeed } from "../../helpers/testProject.ts";
import {
  COMPILED_EDITOR_HTML,
  PUBLIC_HOST,
  SHELL_HTML,
  createShell,
  requestUpgrade
} from "../../helpers/jollyServer.ts";
import { createShareLink } from "../../helpers/shares.ts";
import {
  createTempDir,
  removeTempDir
} from "../../helpers/tempDir.ts";

// CONSTANTS
const kPassword = "p".repeat(43);

describe("JollyServer", () => {
  let root: string;
  let shell: string;
  let editorDist: string;

  before(async() => {
    root = await createTempDir("studio-server-");
    shell = await createShell(root);
    editorDist = await createDist();
  });

  after(async() => {
    await removeTempDir(root);
    await removeTempDir(path.dirname(editorDist));
  });

  async function openServer(): Promise<JollyServer> {
    return JollyServer.open({
      hosting: ProjectHosting.single(root),
      openProject: async() => voxelMapProject(root, editorDist),
      shell,
      allowedHosts: [PUBLIC_HOST],
      backend: {
        inMemory: true,
        seed: await testSeed(),
        preferences: NO_SHELL_PREFERENCES
      }
    });
  }

  test("serves the shell, its editor pages, the manifest and the API on one port", async() => {
    await using server = await openServer();
    const url = await server.listen(0, "127.0.0.1");

    const shellPage = await fetch(url);
    const editorPage = await fetch(new URL("editors/voxel-map/", url));
    const unknownEditor = await fetch(new URL("editors/unknown/", url));
    const manifest = await fetch(new URL(PROJECT_MANIFEST_FILE, url));
    const api = await fetch(new URL("api/unknown", url));

    assert.equal(await shellPage.text(), SHELL_HTML);
    assert.equal(await editorPage.text(), COMPILED_EDITOR_HTML);
    assert.equal(unknownEditor.status, 404);
    assert.deepEqual(
      (await manifest.json()).editors,
      [
        {
          name: "voxel-map",
          package: "@jolly-pixel/editor.voxel-map",
          kinds: ["voxelmap"],
          preferences: [],
          sharedPreferences: [],
          sceneComponents: []
        }
      ]
    );
    assert.equal(api.status, 404);
    assert.equal((await api.json()).code, "not-found");
  });

  test("answers a share link with the editor page compiled into the shell", async() => {
    await using server = await openServer();
    const url = await server.listen(0, "127.0.0.1");
    const owner = browser(new URL(`.${ACCOUNTS_URL_PATH}`, url));
    await owner.client.register("Alice", kPassword);
    const link = await createShareLink(owner, url, "map-overworld");

    const page = await fetch(new URL(`.${VIEW_PAGES_PREFIX}${link.token}`, url));

    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>Compiled Voxel Map<\/title>/);
  });

  test("upgrades a WebSocket only for an allowed host", async() => {
    await using server = await openServer();
    const url = await server.listen(0, "127.0.0.1");

    const allowed = await requestUpgrade(url, PUBLIC_HOST);
    allowed.socket?.destroy();
    const refused = await requestUpgrade(url, "elsewhere.example.com");

    assert.equal(allowed.status, 101);
    assert.equal(refused.status, 403);
  });

  test("closes while a WebSocket is still open", { timeout: 10_000 }, async() => {
    const server = await openServer();
    const url = await server.listen(0, "127.0.0.1");
    const { socket } = await requestUpgrade(url, PUBLIC_HOST);
    assert.ok(socket !== null);
    const closed = once(socket, "close");

    await server[Symbol.asyncDispose]();
    await closed;
  });

  test("refuses to open without a built shell", async() => {
    await assert.rejects(
      JollyServer.open({
        hosting: ProjectHosting.single(root),
        openProject: async() => voxelMapProject(root, editorDist),
        shell: path.join(root, "missing"),
        backend: {
          preferences: NO_SHELL_PREFERENCES
        }
      }),
      /build the studio before serving it/
    );
  });

  test("answers a project whose editor the shell lacks with the editor's name", async() => {
    const staleShell = path.join(root, "stale-shell");
    await fs.mkdir(staleShell);
    await fs.writeFile(path.join(staleShell, "index.html"), SHELL_HTML);
    await using server = await JollyServer.open({
      hosting: ProjectHosting.single(root),
      openProject: async() => voxelMapProject(root, editorDist),
      shell: staleShell,
      backend: {
        inMemory: true,
        preferences: NO_SHELL_PREFERENCES
      }
    });
    const url = await server.listen(0, "127.0.0.1");

    const page = await fetch(url);

    assert.equal(page.status, 503);
    assert.match(await page.text(), /lacks the editors voxel-map/);
  });
});
