// Import Node.js Dependencies
import { existsSync } from "node:fs";
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
  createProjectContributionsPlugin,
  createProjectFileWatchPlugin,
  createProjectKindsPlugin
} from "@jolly-pixel/asset-server/node";
import {
  PORTS,
  RunMode
} from "@jolly-pixel/e2e";
import {
  PLAY_PAGE_DIR,
  PLAY_PAGE_PATH,
  PREVIEW_PAGE_DIR,
  PREVIEW_PAGE_PATH
} from "@jolly-pixel/server";
import { StudioServerSettings } from "@jolly-pixel/server/node";

// Import Internal Dependencies
import { openStudioProject } from "./node/studioFiles.ts";
import { backend } from "./vite/backend.ts";
import { EditorPageFiles } from "./vite/EditorPageFiles.ts";
import { editorPages } from "./vite/editorPages.ts";
import { projectManifest } from "./vite/projectManifest.ts";

// CONSTANTS
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
  const settings = StudioServerSettings.parse(process.env);
  const project = await openStudioProject({
    inMemory: mode.assetServer.inMemory,
    settings
  });

  return {
    base: "./",
    build: {
      manifest: true
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
          ...project.privateFiles
        ]
      }
    },
    plugins: [
      mode.plugins(),
      createProjectKindsPlugin(project.kinds),
      createProjectContributionsPlugin(
        project.kinds,
        Array.from(project.editors, (editor) => editor.package)
      ),
      projectManifest(project),
      createProjectFileWatchPlugin(project.file),
      editorPages(
        new EditorPageFiles(project.editors),
        {
          shellPages: {
            index: "index.html",
            [PREVIEW_PAGE_DIR]: PREVIEW_PAGE_PATH,
            [PLAY_PAGE_DIR]: PLAY_PAGE_PATH
          }
        }
      ),
      mode.serve && backend(project, mode, settings)
    ]
  };
});
