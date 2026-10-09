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
  createAssetWorkspacePlugin,
  createProjectFileWatchPlugin,
  createProjectKindsPlugin
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
import { accountsPlugin } from "./vite/accountsPlugin.ts";
import { editorPagesPlugin } from "./vite/editorPagesPlugin.ts";
import { projectManifestPlugin } from "./vite/projectManifestPlugin.ts";
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
const kViteDefaultDeny = [
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**"
];

async function assetWorkspacePlugin(
  project: StudioProject,
  accounts: Accounts,
  inMemory: boolean
): Promise<Plugin> {
  return createAssetWorkspacePlugin({
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
    }
  });
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
      accounts === null ? null : accountsPlugin(accounts),
      accounts === null ? null : await assetWorkspacePlugin(project, accounts, e2e)
    ]
  };
});
