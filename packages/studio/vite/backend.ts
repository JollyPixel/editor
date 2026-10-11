// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import {
  createLogger,
  type Plugin
} from "vite";
import {
  CatalogViewExtension,
  type CatalogProjection
} from "@jolly-pixel/asset-server";
import { createAssetWorkspacePlugin } from "@jolly-pixel/asset-server/node";
import type { RunMode } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  ACCOUNTS_STATE_IGNORES,
  openStudioAccounts,
  type StudioAccountsOptions
} from "../server/accounts.ts";
import { StudioApi } from "../server/api/StudioApi.ts";
import type { StudioProject } from "../server/project/StudioProject.ts";
import { SharePage } from "../server/shares/SharePage.ts";
import { StudioShares } from "../server/shares/StudioShares.ts";
import { createStudioSeed } from "../src/seed.ts";

// CONSTANTS
const kBlocksetFile = path.join(
  import.meta.dirname,
  "..",
  "public",
  "textures",
  "blockset.png"
);
const kRoomGraceMs = 5 * 60_000;
const kE2ERequestsPerMinute = 100_000;
const kE2EAccounts: StudioAccountsOptions = {
  inMemory: true,
  defaultRole: "member",
  throttle: {
    registrations: 1_000
  }
};

export async function backend(
  project: StudioProject,
  mode: RunMode
): Promise<Plugin[]> {
  const accounts = await openStudioAccounts(
    project,
    mode.e2e ? kE2EAccounts : {
      env: process.env,
      logger: createLogger()
    }
  );
  const catalog = Promise.withResolvers<CatalogProjection>();
  const shares = new StudioShares({
    accounts,
    access: project.access,
    catalog: catalog.promise
  });
  const sharePage = new SharePage({
    shares,
    editors: project.editors
  });
  let api: StudioApi | null = null;

  return [
    {
      name: "studio-backend",
      apply: "serve",
      async configureServer(server) {
        api = await StudioApi.open({
          accounts,
          shares,
          requestsPerMinute: mode.e2e ? kE2ERequestsPerMinute : undefined
        });
        server.middlewares.use(api.middleware);
        server.middlewares.use(sharePage.middleware);
      },
      closeBundle: {
        order: "post",
        sequential: true,
        async handler() {
          await api?.[Symbol.asyncDispose]();
          api = null;
          accounts[Symbol.dispose]();
        }
      }
    },
    createAssetWorkspacePlugin({
      http: false,
      root: project.file.root,
      inMemory: mode.inMemory,
      handlers: project.kinds.handlers(),
      seed: await createStudioSeed(
        await fs.readFile(kBlocksetFile)
      ),
      roomGraceMs: kRoomGraceMs,
      rights: project.access.rights,
      defaultRole: accounts.roles.defaultRole,
      auth: accounts,
      extensions: [accounts.extension],
      backend: {
        stateIgnores: ACCOUNTS_STATE_IGNORES
      },
      admits: (identity, room) => shares.admits(identity, room),
      onReady(workspace) {
        catalog.resolve(workspace.backend.catalog);

        const extension = new CatalogViewExtension({
          catalog: workspace.backend.catalog,
          scope: (identity) => shares.scope(identity)
        });
        workspace.server.register(extension);
      }
    })
  ];
}
