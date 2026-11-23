// Import Third-party Dependencies
import type {
  HtmlTagDescriptor,
  Plugin
} from "vite";
import {
  ACCOUNTS_ROUTES,
  ACCOUNTS_URL_PATH
} from "@jolly-pixel/accounts";
import { PROJECT_MANIFEST_FILE } from "@jolly-pixel/server";

// CONSTANTS
const kShellPage = "/index.html";
const kStaticMode = "static";

export function bootPreloads(): Plugin {
  let backend = true;

  return {
    name: "studio-boot-preloads",
    configResolved(config) {
      backend = config.mode !== kStaticMode;
    },
    transformIndexHtml(_html, context) {
      if (context.path !== kShellPage) {
        return [];
      }

      const files = [`./${PROJECT_MANIFEST_FILE}`];
      if (backend) {
        files.push(`.${ACCOUNTS_URL_PATH}${ACCOUNTS_ROUTES.me.path}`);
      }

      return files.map(preload);
    }
  };
}

function preload(
  href: string
): HtmlTagDescriptor {
  return {
    tag: "link",
    attrs: {
      rel: "preload",
      href,
      as: "fetch",
      crossorigin: "anonymous"
    },
    injectTo: "head-prepend"
  };
}
