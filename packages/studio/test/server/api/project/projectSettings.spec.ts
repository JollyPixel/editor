// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { DEFAULT_ACCESS } from "../../../../server/project/StudioAccess.ts";
import { KindOptionsDraft } from "../../../../src/project/KindOptionsDraft.ts";
import { ProjectSettingsClient } from "../../../../src/project/ProjectSettingsClient.ts";
import { PROJECT_URL_PATH } from "../../../../shared/api/project.ts";
import { browser } from "../../../helpers/browser.ts";
import {
  serveBackend,
  type ServedBackend
} from "../../../helpers/studioBackend.ts";

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
    await admin.replaceAccess({
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

    const replaced = await member.replaceKinds({
      ...kinds,
      "@jolly-pixel/asset.voxel-model": {
        snapshot: {
          delay: 500,
          maxDelay: 30_000
        }
      }
    });

    const voxelModel = replaced.kinds.find(
      ({ name }) => name === "@jolly-pixel/asset.voxel-model"
    );
    assert.equal(replaced.access, undefined);
    assert.deepEqual(voxelModel?.options, {
      snapshot: {
        delay: 500,
        maxDelay: 30_000
      }
    });
    await assert.rejects(member.replaceAccess({
      access,
      renamedRoles: {}
    }), {
      name: "ApiRequestError",
      status: 403
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
      admin.replaceKinds({
        ...kinds,
        "@jolly-pixel/asset.voxel-model": {
          snapshot: {
            delay: -1
          }
        }
      }),
      {
        name: "ApiRequestError",
        status: 400
      }
    );
    await assert.rejects(
      admin.replaceAccess({
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
