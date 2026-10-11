// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";

loadEnvFile();

// Import Third-party Dependencies
import {
  createLogger,
  defineConfig,
  searchForWorkspaceRoot,
  type Plugin,
  type UserConfig
} from "vite";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  CatalogViewExtension,
  type CatalogProjection
} from "@jolly-pixel/asset-server";
import {
  createAssetWorkspacePlugin,
  createProjectFileWatchPlugin,
  createProjectKindsPlugin,
  type AssetWorkspacePluginOptions
} from "@jolly-pixel/asset-server/node";
import type { Accounts } from "@jolly-pixel/accounts/node";
import {
  PORTS,
  prebundleWorkspace
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { EditorPages } from "./server/editors/EditorPages.ts";
import {
  ACCOUNTS_STATE_IGNORES,
  openStudioAccounts
} from "./server/accounts.ts";
import { StudioProject } from "./server/project/StudioProject.ts";
import { SharePage } from "./server/shares/SharePage.ts";
import { StudioShares } from "./server/shares/StudioShares.ts";
import { apiPlugin } from "./vite/apiPlugin.ts";
import { editorPagesPlugin } from "./vite/editorPagesPlugin.ts";
import { projectManifestPlugin } from "./vite/projectManifestPlugin.ts";
import { sharePagePlugin } from "./vite/sharePagePlugin.ts";
import { createStudioSeed } from "./src/seed.ts";

// CONSTANTS
const kBlocksetFile = path.join(
  import.meta.dirname,
  "public",
  "textures",
  "blockset.png"
);
const kRoomGraceMs = 5 * 60_000;
const kE2EDefaultRole = "member";
const kE2ERegistrations = 1_000;
const kE2ERequestsPerMinute = 100_000;
const kViteDefaultDeny = [
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**"
];

type SharingOptions = Pick<AssetWorkspacePluginOptions, "admits" | "onReady">;

async function assetWorkspacePlugin(
  project: StudioProject,
  accounts: Accounts,
  inMemory: boolean,
  sharing: SharingOptions
): Promise<Plugin> {
  return createAssetWorkspacePlugin({
    http: false,
    root: project.file.root,
    ...(inMemory ? {
      source: new MemoryAssetSource(),
      eventStore: EventStore.persistence.memory()
    } : {}),
    handlers: project.kinds.handlers(),
    seed: await createStudioSeed(await fs.readFile(kBlocksetFile)),
    roomGraceMs: kRoomGraceMs,
    rights: project.access.rights,
    defaultRole: accounts.roles.defaultRole,
    auth: accounts,
    extensions: [accounts.extension],
    backend: {
      stateIgnores: ACCOUNTS_STATE_IGNORES
    },
    ...sharing
  });
}

function disposeAfterClose(
  resource: Disposable
): Plugin {
  return {
    name: "studio-dispose-after-close",
    apply: "serve",
    closeBundle: {
      order: "post",
      sequential: true,
      handler() {
        resource[Symbol.dispose]();
      }
    }
  };
}

async function accountsPlugins(
  project: StudioProject,
  accounts: Accounts,
  e2e: boolean
): Promise<Plugin[]> {
  const catalog = Promise.withResolvers<CatalogProjection>();
  const shares = new StudioShares({
    accounts,
    access: project.access,
    catalog: catalog.promise
  });

  return [
    apiPlugin({
      accounts,
      shares,
      requestsPerMinute: e2e ? kE2ERequestsPerMinute : undefined
    }),
    sharePagePlugin(new SharePage({
      shares,
      editors: project.editors
    })),
    await assetWorkspacePlugin(project, accounts, e2e, {
      admits: (identity, room) => shares.admits(identity, room),
      onReady(workspace) {
        catalog.resolve(workspace.backend.catalog);
        workspace.server.register(new CatalogViewExtension({
          catalog: workspace.backend.catalog,
          scope: (identity) => shares.scope(identity)
        }));
      }
    }),
    disposeAfterClose(accounts)
  ];
}

export default defineConfig(async({ mode }): Promise<UserConfig> => {
  const e2e = mode === "e2e";
  const inMemory = e2e || mode === "static";
  const project = await StudioProject.open(
    StudioProject.resolveRoot(import.meta.dirname),
    { inMemory }
  );
  const accounts = mode === "static" ? null : await openStudioAccounts(
    project,
    e2e ? {
      inMemory: true,
      defaultRole: kE2EDefaultRole,
      throttle: {
        registrations: kE2ERegistrations
      }
    } : {
      env: process.env,
      logger: createLogger()
    }
  );

  return {
    base: "./",
    server: {
      ...(e2e ? {
        port: PORTS.studio,
        strictPort: true
      } : {
        allowedHosts: true
      }),
      fs: {
        allow: [
          searchForWorkspaceRoot(import.meta.dirname),
          ...project.kinds.resolver.directories
        ],
        deny: [
          ...kViteDefaultDeny,
          ...project.privateFiles
        ]
      }
    },
    plugins: [
      prebundleWorkspace(),
      createProjectKindsPlugin(project.kinds),
      projectManifestPlugin(project),
      inMemory ? null : createProjectFileWatchPlugin(project.file),
      editorPagesPlugin(new EditorPages(project.editors)),
      ...(accounts === null ? [] : await accountsPlugins(project, accounts, e2e))
    ]
  };
});
