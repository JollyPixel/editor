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

// Import Internal Dependencies
import { EditorPages } from "./server/editors/EditorPages.ts";
import { StudioProject } from "./server/project/StudioProject.ts";
import { backend } from "./vite/backend.ts";
import { editorPages } from "./vite/editorPages.ts";
import { projectManifest } from "./vite/projectManifest.ts";
import {
  PLAY_PAGE_DIR,
  PLAY_PAGE_PATH,
  PREVIEW_PAGE_DIR,
  PREVIEW_PAGE_PATH
} from "./shared/EditorDescriptor.ts";

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
  const project = await StudioProject.open(
    StudioProject.resolveRoot(import.meta.dirname),
    mode.assetServer
  );

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
        new EditorPages(project.editors),
        {
          shellPages: {
            index: "index.html",
            [PREVIEW_PAGE_DIR]: PREVIEW_PAGE_PATH,
            [PLAY_PAGE_DIR]: PLAY_PAGE_PATH
          }
        }
      ),
      mode.serve && backend(project, mode)
    ]
  };
});
