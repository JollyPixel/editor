// Import Third-party Dependencies
import type { Plugin } from "vite";
import type { Accounts } from "@jolly-pixel/accounts/node";

export function accountsPlugin(
  accounts: Accounts
): Plugin {
  return {
    name: "studio-accounts",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(accounts.handler);
    },
    closeBundle() {
      accounts[Symbol.dispose]();
    }
  };
}
