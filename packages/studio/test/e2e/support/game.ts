// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import type {
  APIRequestContext,
  Locator,
  Page
} from "@playwright/test";
import { CatalogClient } from "@jolly-pixel/asset-server/client";
import type { Client } from "@jolly-pixel/network/client";
import { PLAY_PAGE_DIR } from "@jolly-pixel/server";

// Import Internal Dependencies
import { agentClient } from "./golem.ts";

export interface SceneScript {
  scriptId: string;
  behavior: string;
}

export class GameSeed implements Disposable {
  static async connect(
    request: APIRequestContext,
    baseURL: string
  ): Promise<GameSeed> {
    const client = await agentClient(request, baseURL, "Game seed");

    return new GameSeed(client, await CatalogClient.connect(client));
  }

  #client: Client;
  #catalog: CatalogClient;

  constructor(
    client: Client,
    catalog: CatalogClient
  ) {
    this.#client = client;
    this.#catalog = catalog;
  }

  create(
    path: string,
    content: string
  ): Promise<string> {
    return this.#catalog.create(path, new TextEncoder().encode(content));
  }

  createScene(
    path: string,
    script: SceneScript
  ): Promise<string> {
    return this.create(path, JSON.stringify({
      version: 1,
      environment: {
        background: null,
        environment: {
          kind: "none",
          intensity: 1
        },
        fog: {
          kind: "none"
        }
      },
      actors: [
        actor("Camera", {
          id: randomUUID(),
          type: "Camera",
          data: {
            projectionMode: "perspective"
          },
          assets: {}
        }),
        actor(script.behavior, {
          id: randomUUID(),
          type: "Script",
          data: {
            behavior: script.behavior,
            properties: {}
          },
          assets: {
            script: {
              id: script.scriptId,
              kind: "script"
            }
          }
        })
      ]
    }));
  }

  [Symbol.dispose](): void {
    this.#catalog.dispose();
    this.#client.destroy();
  }
}

export class PlayerWindow {
  readonly error: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.error = page.locator("#play-error");
  }

  async play(
    sceneId: string
  ): Promise<void> {
    await this.#page.goto(
      `/${PLAY_PAGE_DIR}/?start=${encodeURIComponent(sceneId)}`
    );
  }
}

function actor(
  name: string,
  component: Record<string, unknown>
): Record<string, unknown> {
  return {
    id: randomUUID(),
    name,
    parentId: null,
    components: [component]
  };
}
