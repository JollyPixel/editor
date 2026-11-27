// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";
import { AUDIT_URL_PATH, PROJECT_URL_PATH } from "@jolly-pixel/server";
import {
  browser,
  type ServedBackend
} from "@jolly-pixel/server/testing";

// Import Internal Dependencies
import { AuditClient } from "../../src/audit/AuditClient.ts";
import { KindOptionsDraft } from "../../src/project/KindOptionsDraft.ts";
import { ProjectSettingsClient } from "../../src/project/ProjectSettingsClient.ts";
import { serveBackend } from "../helpers/studioBackend.ts";

// CONSTANTS
const kPassword = "p".repeat(43);

interface SignedInClients {
  audit: AuditClient;
  settings: ProjectSettingsClient;
}

async function signedIn(
  backend: ServedBackend,
  username: string
): Promise<SignedInClients> {
  const page = browser(new URL(`.${ACCOUNTS_URL_PATH}`, backend.url));
  await page.client.register(username, kPassword);

  return {
    audit: new AuditClient({
      url: new URL(`.${AUDIT_URL_PATH}`, backend.url),
      fetch: page.fetch
    }),
    settings: new ProjectSettingsClient({
      url: new URL(`.${PROJECT_URL_PATH}`, backend.url),
      fetch: page.fetch
    })
  };
}

describe("GET /api/audit", () => {
  test("shows settings changes and registrations to an admin, newest first", async() => {
    await using backend = await serveBackend();
    const admin = await signedIn(backend, "Alice");
    await signedIn(backend, "Bob");
    const settings = await admin.settings.read();
    const kinds = KindOptionsDraft.from(settings.kinds).toJSON();
    await admin.settings.replace({
      revision: settings.revision,
      sections: {
        kinds: {
          ...kinds,
          "@jolly-pixel/asset.voxel-map": {
            voxelmap: {
              chunkSize: 8
            }
          }
        }
      }
    });

    const { rows } = await admin.audit.page();

    assert.deepEqual(
      rows.slice(0, 3).map((row) => `${row.actor.name} ${row.type}`),
      ["Alice settings", "Bob account", "Alice account"]
    );
    const [change] = rows;
    assert.ok(change.type === "settings");
    assert.deepEqual(change.before, kinds);
  });

  test("lists who acted and exports the rows as CSV", async() => {
    await using backend = await serveBackend();
    const admin = await signedIn(backend, "Alice");
    await signedIn(backend, "Bob");

    const actors = await admin.audit.actors();
    const download = await admin.audit.export({ category: "accounts" });
    const lines = (await download.blob.text()).trimEnd().split("\r\n");

    assert.deepEqual(actors.map((actor) => actor.name), ["Alice", "Bob"]);
    assert.equal(download.fileName, "audit.csv");
    assert.equal(lines[0], "Started,Ended,Actor,Actor kind,Category,Event,Asset,Details");
    assert.deepEqual(
      lines.slice(1).map((line) => line.split(",").slice(2, 6).join(" ")),
      ["Bob user accounts account registered", "Alice user accounts account registered"]
    );
  });

  test("refuses a role without studio.$audit", async() => {
    await using backend = await serveBackend();
    await signedIn(backend, "Alice");
    const member = await signedIn(backend, "Bob");

    await assert.rejects(member.audit.page(), {
      name: "ApiRequestError",
      status: 403
    });
  });
});
