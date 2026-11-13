// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  GOLEM_TOKENS_URL_PATH,
  createdAgentTokenReplySchema,
  type CreatedAgentTokenReply
} from "@jolly-pixel/server";
import {
  DEFAULT_ACCESS,
  StudioProject,
  type GamePlayer
} from "@jolly-pixel/server/node";
import {
  listenBackend,
  type Browser,
  type ServedBackend
} from "@jolly-pixel/server/testing";

// CONSTANTS
const kAssetsDir = path.join(import.meta.dirname, "..", "..", "..", "assets");
const kEditorsDir = path.join(import.meta.dirname, "..", "..", "..", "editors");
const kPassword = "p".repeat(43);
const kNoPlayer: GamePlayer = {
  files: () => Promise.reject(new Error("golem tests build no game"))
};

export interface StudioOptions {
  /**
   * @default "member"
   */
  defaultRole?: string;
}

export async function serveStudio(
  options: StudioOptions = {}
): Promise<ServedBackend> {
  const project = await StudioProject.open(
    path.join(import.meta.dirname, "..", "project"),
    {
      inMemory: true,
      packages: {
        searchFolders: [kAssetsDir, kEditorsDir]
      },
      template: {
        version: 1,
        editors: [
          "@jolly-pixel/editor.scene",
          "@jolly-pixel/editor.script"
        ],
        kinds: {
          "@jolly-pixel/asset.scene": {},
          "@jolly-pixel/asset.script": {},
          "@jolly-pixel/asset.voxel-map": {},
          "@jolly-pixel/asset.voxel-model": {},
          "@jolly-pixel/asset.pixel-art": {}
        },
        access: DEFAULT_ACCESS
      }
    }
  );

  return listenBackend(project, {
    defaultRole: options.defaultRole,
    player: kNoPlayer
  });
}

export async function registered(
  backend: ServedBackend,
  username: string
): Promise<Browser> {
  const account = backend.browser();
  await account.client.register(username, kPassword);

  return account;
}

export async function createAgentToken(
  backend: ServedBackend,
  owner: Browser,
  name: string
): Promise<CreatedAgentTokenReply> {
  const response = await owner.fetch(
    new URL(`.${GOLEM_TOKENS_URL_PATH}`, backend.url),
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ name })
    }
  );

  return createdAgentTokenReplySchema.parse(await response.json());
}

export async function revokeAgentToken(
  backend: ServedBackend,
  owner: Browser,
  tokenId: string
): Promise<void> {
  await owner.fetch(
    new URL(`.${GOLEM_TOKENS_URL_PATH}${tokenId}`, backend.url),
    {
      method: "DELETE"
    }
  );
}
