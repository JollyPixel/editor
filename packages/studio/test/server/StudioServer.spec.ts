// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import type { Duplex } from "node:stream";
import path from "node:path";

// Import Third-party Dependencies
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";

// Import Internal Dependencies
import { PROJECT_MANIFEST_FILE } from "../../src/editors/ProjectManifest.ts";
import { StudioServer } from "../../server/StudioServer.ts";
import {
  createDist,
  voxelMapProject
} from "../helpers/editorPages.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

// CONSTANTS
const kShellHtml = "<!DOCTYPE html><title>JollyPixel Studio</title>";
const kCompiledEditorHtml = "<!DOCTYPE html><title>Compiled Voxel Map</title>";
const kPublicHost = "studio.example.com";

interface Upgrade {
  status: number | undefined;
  socket: Duplex | null;
}

function requestUpgrade(
  url: URL,
  host: string
): Promise<Upgrade> {
  const { promise, resolve, reject } = Promise.withResolvers<Upgrade>();
  const request = http.request(new URL(DEFAULT_WEBSOCKET_PATH, url), {
    headers: {
      host,
      connection: "Upgrade",
      upgrade: "websocket",
      "sec-websocket-version": "13",
      "sec-websocket-key": randomBytes(16).toString("base64")
    }
  });
  request.once("upgrade", (response, socket) => {
    resolve({
      status: response.statusCode,
      socket
    });
  });
  request.once("response", (response) => {
    response.resume();
    resolve({
      status: response.statusCode,
      socket: null
    });
  });
  request.once("error", reject);
  request.end();

  return promise;
}

describe("StudioServer", () => {
  let root: string;
  let shell: string;
  let editorDist: string;

  before(async() => {
    root = await createTempDir("studio-server-");
    shell = path.join(root, "shell");
    await fs.mkdir(shell);
    await fs.writeFile(path.join(shell, "index.html"), kShellHtml);
    await fs.mkdir(path.join(shell, "editors", "voxel-map"), { recursive: true });
    await fs.writeFile(
      path.join(shell, "editors", "voxel-map", "index.html"),
      kCompiledEditorHtml
    );
    editorDist = await createDist();
  });

  after(async() => {
    await removeTempDir(root);
    await removeTempDir(path.dirname(editorDist));
  });

  function openServer(): Promise<StudioServer> {
    return StudioServer.open({
      project: voxelMapProject(root, editorDist),
      shell,
      allowedHosts: [kPublicHost],
      backend: {
        inMemory: true,
        accounts: {
          inMemory: true
        }
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

    assert.equal(await shellPage.text(), kShellHtml);
    assert.equal(await editorPage.text(), kCompiledEditorHtml);
    assert.equal(unknownEditor.status, 404);
    assert.deepEqual(
      (await manifest.json()).editors,
      [
        {
          name: "voxel-map",
          kinds: ["voxelmap"],
          preferences: []
        }
      ]
    );
    assert.equal(api.status, 404);
    assert.equal((await api.json()).code, "not-found");
  });

  test("upgrades a WebSocket only for an allowed host", async() => {
    await using server = await openServer();
    const url = await server.listen(0, "127.0.0.1");

    const allowed = await requestUpgrade(url, kPublicHost);
    allowed.socket?.destroy();
    const refused = await requestUpgrade(url, "elsewhere.example.com");

    assert.equal(allowed.status, 101);
    assert.equal(refused.status, 403);
  });

  test("closes while a WebSocket is still open", { timeout: 10_000 }, async() => {
    const server = await openServer();
    const url = await server.listen(0, "127.0.0.1");
    const { socket } = await requestUpgrade(url, kPublicHost);
    assert.ok(socket !== null);
    const closed = once(socket, "close");

    await server[Symbol.asyncDispose]();
    await closed;
  });

  test("refuses to open without a built shell", async() => {
    await assert.rejects(
      StudioServer.open({
        project: voxelMapProject(root, editorDist),
        shell: path.join(root, "missing")
      }),
      /build the studio before serving it/
    );
  });

  test("refuses to open a shell built without an editor page", async() => {
    const staleShell = path.join(root, "stale-shell");
    await fs.mkdir(staleShell);
    await fs.writeFile(path.join(staleShell, "index.html"), kShellHtml);
    const editorPage = path.join(staleShell, "editors", "voxel-map", "index.html");

    await assert.rejects(
      StudioServer.open({
        project: voxelMapProject(root, editorDist),
        shell: staleShell
      }),
      {
        message: `"${editorPage}" is missing: build the studio before serving it.`
      }
    );
  });
});
