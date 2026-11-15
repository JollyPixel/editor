// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  normalizePath,
  type HtmlTagDescriptor,
  type IndexHtmlTransformContext,
  type Plugin
} from "vite";
import {
  PLAY_PAGE_DIR,
  PLAY_PAGE_PATHNAMES
} from "@jolly-pixel/server";

// CONSTANTS
const kModulesDir = "src/play/modules";

export const PLAYER_MODULES: Readonly<Record<string, string>> = {
  three: "three.ts",
  "three/webgpu": "three.ts",
  "three/tsl": "three-tsl.ts",
  "@jolly-pixel/engine": "engine.ts"
};

export function playerModules(): Plugin {
  const files = new Set(Object.values(PLAYER_MODULES));
  let root = "";
  let building = false;

  function modulePath(
    file: string
  ): string {
    return normalizePath(path.join(root, kModulesDir, file));
  }

  function moduleUrl(
    file: string,
    context: IndexHtmlTransformContext
  ): string {
    if (context.bundle === undefined) {
      return `../${kModulesDir}/${file}`;
    }

    const source = modulePath(file);
    const chunk = Object.values(context.bundle).find(
      (output) => output.type === "chunk" && output.facadeModuleId === source
    );
    if (chunk === undefined) {
      throw new Error(`The player build emitted no chunk for "${source}".`);
    }

    return path.posix.relative(PLAY_PAGE_DIR, chunk.fileName);
  }

  return {
    name: "studio-player-modules",
    config(_config, env) {
      building = env.command === "build";

      return building ?
        {} :
        {
          optimizeDeps: {
            entries: Array.from(files, (file) => `${kModulesDir}/${file}`)
          }
        };
    },
    configResolved(config) {
      root = config.root;
    },
    buildStart() {
      if (!building) {
        return;
      }

      for (const file of files) {
        this.emitFile({
          type: "chunk",
          id: modulePath(file),
          name: `player-${path.parse(file).name}`,
          preserveSignature: "strict"
        });
      }
    },
    transformIndexHtml: {
      order: "post",
      handler(_html, context): HtmlTagDescriptor[] {
        if (!PLAY_PAGE_PATHNAMES.has(context.path)) {
          return [];
        }

        const imports = Object.fromEntries(Object.entries(PLAYER_MODULES).map(
          ([specifier, file]) => [specifier, moduleUrl(file, context)]
        ));

        return [
          {
            tag: "script",
            attrs: {
              type: "importmap"
            },
            children: JSON.stringify({ imports }),
            injectTo: "head-prepend"
          }
        ];
      }
    }
  };
}
