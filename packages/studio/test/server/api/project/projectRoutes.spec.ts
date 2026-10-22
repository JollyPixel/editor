// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";
import { readAssetArchive } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { STUDIO_ROOT } from "../../../../server/project/StudioProject.ts";
import { ProjectArchiveClient } from "../../../../src/project/ProjectArchiveClient.ts";
import { PROJECT_URL_PATH } from "../../../../shared/api/project.ts";
import { createStudioSeed } from "../../../../shared/seed.ts";
import { browser } from "../../../helpers/studioApi.ts";
import {
  serveBackend,
  type ServedBackend
} from "../../../helpers/studioBackend.ts";

// CONSTANTS
const kPassword = "p".repeat(43);

function archiveClient(
  backend: ServedBackend,
  fetch?: typeof globalThis.fetch
): ProjectArchiveClient {
  return new ProjectArchiveClient({
    url: new URL(`.${PROJECT_URL_PATH}`, backend.url),
    fetch
  });
}

async function signedIn(
  backend: ServedBackend,
  username: string
): Promise<typeof globalThis.fetch> {
  const page = browser(new URL(`.${ACCOUNTS_URL_PATH}`, backend.url));
  await page.client.register(username, kPassword);

  return page.fetch;
}

async function seededPaths(): Promise<string[]> {
  const seed = await createStudioSeed(
    await fs.readFile(path.join(STUDIO_ROOT, "public", "textures", "blockset.png"))
  );

  return Object.keys(seed).sort();
}

describe("GET /api/project/archive", () => {
  test("downloads every project asset as one importable archive", async() => {
    await using backend = await serveBackend({ defaultRole: "spectator" });
    const owner = await signedIn(backend, "Alice");

    const client = archiveClient(backend, owner);
    const download = await client.download();

    assert.equal(download.fileName, "project.zip");
    const archive = readAssetArchive(
      new Uint8Array(await download.blob.arrayBuffer())
    ).unwrap();
    assert.equal(archive.root, undefined);
    assert.deepEqual(archive.missing, []);
    assert.deepEqual(
      archive.assets.map((asset) => asset.path).sort(),
      await seededPaths()
    );
  });

  test("refuses a role without write on studio.$export", async() => {
    await using backend = await serveBackend({ defaultRole: "spectator" });
    await signedIn(backend, "Alice");
    const spectator = archiveClient(backend, await signedIn(backend, "Bob"));

    await assert.rejects(
      spectator.download(),
      {
        name: "ApiRequestError",
        status: 403,
        message: "this role cannot export the project"
      }
    );
  });

  test("refuses a request without a session", async() => {
    await using backend = await serveBackend();

    await assert.rejects(
      archiveClient(backend).download(),
      {
        name: "ApiRequestError",
        status: 401
      }
    );
  });
});
