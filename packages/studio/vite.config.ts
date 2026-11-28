// Import Node.js Dependencies
import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) {
  loadEnvFile();
}

// Import Third-party Dependencies
import {
  defineConfig,
  searchForWorkspaceRoot,
  type UserConfig
} from "vite";
import {
  createProjectFileWatchPlugin,
  createProjectKindsPlugin
} from "@jolly-pixel/asset-server/node";
import {
  PORTS,
  RunMode
} from "@jolly-pixel/e2e";
import {
  PLAY_PAGE_DIR,
  PREVIEW_PAGE_DIR,
  PROJECTS_PAGE_DIR
} from "@jolly-pixel/server";
import { ServerSettings } from "@jolly-pixel/server/node";

// Import Internal Dependencies
import {
  openStudioProject,
  STUDIO_ROOT
} from "./node/studioFiles.ts";
import { backend } from "./vite/backend.ts";
import { bootPreloads } from "./vite/bootPreloads.ts";
import { scriptDocs } from "./vite/docs/scriptDocs.ts";
import { EditorPageFiles } from "./vite/pages/EditorPageFiles.ts";
import { editorPages } from "./vite/pages/editorPages.ts";
import { offlinePlay } from "./vite/player/offlinePlay.ts";
import { playerModules } from "./vite/player/modules.ts";
import { projectContributions } from "./vite/project/contributions.ts";
import { projectManifest } from "./vite/project/manifest.ts";

// CONSTANTS
const kLazyKindDependencies = ["opentype.js"];
const kViteDefaultDeny = [
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**"
];

export default defineConfig(async(env): Promise<UserConfig> => {
  const mode = new RunMode(
    env,
    { port: PORTS.studio }
  );
  const settings = ServerSettings.parse(process.env);
  const hosting = settings.hosting(STUDIO_ROOT);
  const project = await openStudioProject({
    inMemory: mode.assetServer.inMemory || settings.hostsFolder,
    settings
  });
  const pages = editorPages(
    new EditorPageFiles(project.editors),
    {
      shellPages: [
        PREVIEW_PAGE_DIR,
        PLAY_PAGE_DIR,
        PROJECTS_PAGE_DIR
      ]
    }
  );

  return {
    base: "./",
    build: {
      manifest: true
    },
    optimizeDeps: {
      exclude: kLazyKindDependencies
    },
    server: {
      ...mode.server,
      fs: {
        allow: [
          searchForWorkspaceRoot(import.meta.dirname),
          ...project.kinds.resolver.directories
        ],
        deny: [
          ...kViteDefaultDeny,
          ...project.privateFiles,
          ...hosting.privateFiles
        ]
      }
    },
    plugins: [
      mode.plugins(),
      createProjectKindsPlugin(project.kinds),
      projectContributions(project),
      projectManifest(project),
      bootPreloads(),
      scriptDocs(path.join(STUDIO_ROOT, "..")),
      createProjectFileWatchPlugin(project.file),
      playerModules(),
      offlinePlay(),
      mode.serve && backend({
        project,
        mode,
        settings,
        pages: pages.api
      }),
      pages
    ]
  };
});
