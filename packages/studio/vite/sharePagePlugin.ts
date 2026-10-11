// Import Third-party Dependencies
import type { Plugin } from "vite";

// Import Internal Dependencies
import type { SharePage } from "../server/shares/SharePage.ts";

export function sharePagePlugin(
  page: SharePage
): Plugin {
  return {
    name: "studio-share-page",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(page.middleware);
    }
  };
}
