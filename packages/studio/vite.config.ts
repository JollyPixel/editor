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
  createProjectFileWatchPlugin,
  createProjectKindsPlugin
} from "@jolly-pixel/asset-server/node";
import {
  PORTS,
  precompress,
  prebundleWorkspace,
  RunMode
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { EditorPages } from "./server/editors/EditorPages.ts";
import { StudioProject } from "./server/project/StudioProject.ts";
import { backend } from "./vite/backend.ts";
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
  const project = await StudioProject.open(
    StudioProject.resolveRoot(import.meta.dirname),
    mode
  );

  return {
    base: "./",
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
      prebundleWorkspace(),
      precompress(),
      createProjectKindsPlugin(project.kinds),
      projectManifest(project),
      createProjectFileWatchPlugin(project.file),
      editorPages(
        new EditorPages(project.editors)
      ),
      mode.serve && backend(project, mode)
    ]
  };
});
