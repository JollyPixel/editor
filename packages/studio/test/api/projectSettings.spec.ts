// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";
import {
  PROJECT_URL_PATH,
  type ProjectSettingsReply,
  type SettingsSectionBody,
  type SettingsSectionName
} from "@jolly-pixel/server";
import { DEFAULT_ACCESS } from "@jolly-pixel/server/node";
import {
  browser,
  type ServedBackend
} from "@jolly-pixel/server/testing";

// Import Internal Dependencies
import { KindOptionsDraft } from "../../src/project/KindOptionsDraft.ts";
import { ProjectSettingsClient } from "../../src/project/ProjectSettingsClient.ts";
import { serveBackend } from "../helpers/studioBackend.ts";

// CONSTANTS
const kPassword = "p".repeat(43);

async function settingsClient(
  backend: ServedBackend,
  username: string
): Promise<ProjectSettingsClient> {
  const page = browser(new URL(`.${ACCOUNTS_URL_PATH}`, backend.url));
  await page.client.register(username, kPassword);

  return new ProjectSettingsClient({
    url: new URL(`.${PROJECT_URL_PATH}`, backend.url),
    fetch: page.fetch
  });
}

async function update<TName extends SettingsSectionName>(
  client: ProjectSettingsClient,
  section: TName,
  body: SettingsSectionBody<TName>,
  revision?: string
): Promise<ProjectSettingsReply> {
  return client.replace({
    revision: revision ?? (await client.read()).revision,
    sections: {
      [section]: body
    }
  });
}

describe("/api/project/settings", () => {
  test("shows the access section to admins and nothing to a role without studio.$settings", async() => {
    await using backend = await serveBackend();
    const admin = await settingsClient(backend, "Alice");
    const member = await settingsClient(backend, "Bob");

    const settings = await admin.read();

    assert.deepEqual((await admin.rights()).toJSON(), {
      share: true,
      export: true,
      readSettings: true,
      editSettings: true,
      audit: true,
      manageAccess: true
    });
    assert.equal(settings.name, "project");
    assert.deepEqual(settings.access, DEFAULT_ACCESS);
    assert.deepEqual((await member.rights()).toJSON(), {
      share: true,
      export: true,
      readSettings: false,
      editSettings: false,
      audit: false,
      manageAccess: false
    });
    await assert.rejects(member.read(), {
      name: "ApiRequestError",
      status: 403
    });
  });

  test("lets a role naming studio.$settings edit the kinds but never the access section", async() => {
    await using backend = await serveBackend();
    const admin = await settingsClient(backend, "Alice");
    const { access } = await admin.read();
    assert.ok(access !== undefined);
    await update(admin, "access", {
      access: {
        ...access,
        roles: {
          ...access.roles,
          member: {
            "studio.$settings": "write",
            "*": "write"
          }
        }
      },
      renamedRoles: {}
    });
    const member = await settingsClient(backend, "Bob");
    const kinds = KindOptionsDraft.from((await member.read()).kinds).toJSON();

    const replaced = await update(member, "kinds", {
      ...kinds,
      "@jolly-pixel/asset.voxel-map": {
        voxelmap: {
          chunkSize: 8
        }
      }
    });

    const voxelMap = replaced.kinds.find(
      ({ name }) => name === "@jolly-pixel/asset.voxel-map"
    );
    assert.equal(replaced.access, undefined);
    assert.deepEqual(voxelMap?.options, {
      voxelmap: {
        chunkSize: 8
      }
    });
    await assert.rejects(update(member, "access", {
      access,
      renamedRoles: {}
    }, replaced.revision), {
      name: "ApiRequestError",
      status: 403
    });
  });

  test("shows the kind filter to every account but lets only studio.$settings edit it", async() => {
    await using backend = await serveBackend();
    const admin = await settingsClient(backend, "Alice");
    const member = await settingsClient(backend, "Bob");

    await update(admin, "kindFilter", {
      hidden: ["voxelmodel"]
    });

    assert.deepEqual((await member.sections()).kindFilter.hidden, ["voxelmodel"]);
    await assert.rejects(update(member, "kindFilter", {
      hidden: []
    }, (await admin.read()).revision), {
      name: "ApiRequestError",
      status: 403
    });
    await assert.rejects(update(admin, "kindFilter", {
      hidden: ["unknown"]
    }), {
      name: "ApiRequestError",
      status: 400
    });
  });

  test("shows the default scene to every account but lets only studio.$settings edit it", async() => {
    await using backend = await serveBackend();
    const admin = await settingsClient(backend, "Alice");
    const member = await settingsClient(backend, "Bob");

    assert.deepEqual((await member.sections()).game, { start: null });
    const reply = await update(admin, "game", { start: "arena" });

    assert.deepEqual(reply.game, { start: "arena" });
    assert.deepEqual((await member.sections()).game, { start: "arena" });
    await assert.rejects(update(member, "game", { start: null }, reply.revision), {
      name: "ApiRequestError",
      status: 403
    });
  });

  test("answers 409 with the stale code to a batch read before another save", async() => {
    await using backend = await serveBackend();
    const admin = await settingsClient(backend, "Alice");
    const { revision } = await admin.read();
    await update(admin, "game", { start: "arena" });

    await assert.rejects(update(admin, "game", { start: null }, revision), {
      name: "ApiRequestError",
      status: 409,
      code: "stale-settings"
    });
  });

  test("answers 400 for invalid kind options and 409 for a role an account holds", async() => {
    await using backend = await serveBackend();
    const admin = await settingsClient(backend, "Alice");
    await settingsClient(backend, "Bob");
    const settings = await admin.read();
    const kinds = KindOptionsDraft.from(settings.kinds).toJSON();
    const { access } = settings;
    assert.ok(access !== undefined);

    await assert.rejects(
      update(admin, "kinds", {
        ...kinds,
        "@jolly-pixel/asset.voxel-map": {
          voxelmap: {
            chunkSize: 0
          }
        }
      }),
      {
        name: "ApiRequestError",
        status: 400
      }
    );
    await assert.rejects(
      update(admin, "access", {
        access: {
          ...access,
          roles: {
            spectator: access.roles.spectator
          },
          defaultRole: "spectator"
        },
        renamedRoles: {}
      }),
      {
        name: "ApiRequestError",
        status: 409
      }
    );
  });
});
