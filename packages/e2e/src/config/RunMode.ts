// Import Third-party Dependencies
import type {
  ConfigEnv,
  Plugin,
  ServerOptions
} from "vite";
import type { AssetServerOptions } from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import { CookieAuthentication } from "../roles/CookieAuthentication.ts";
import {
  DEFAULT_ROLE,
  RIGHTS
} from "../roles/protocol.ts";
import { prebundleWorkspace } from "./plugins/prebundleWorkspace.ts";
import { precompress } from "./plugins/precompress.ts";

// CONSTANTS
const kE2EMode = "e2e";

export interface RunModeOptions {
  port: number;
}

export interface RunModeAssetServer extends Required<
  Pick<AssetServerOptions, "inMemory" | "rights" | "defaultRole">
> {
  auth: CookieAuthentication | undefined;
}

export class RunMode {
  readonly serve: boolean;
  readonly e2e: boolean;
  readonly server: ServerOptions;
  readonly assetServer: RunModeAssetServer;

  constructor(
    env: ConfigEnv,
    options: RunModeOptions
  ) {
    this.serve = env.command === "serve";
    this.e2e = env.mode === kE2EMode;
    this.server = this.e2e ?
      {
        port: options.port,
        strictPort: true
      } :
      {
        allowedHosts: true
      };
    this.assetServer = {
      inMemory: this.e2e || !this.serve,
      auth: this.e2e ? new CookieAuthentication() : undefined,
      rights: RIGHTS,
      defaultRole: DEFAULT_ROLE
    };
  }

  plugins(): Plugin[] {
    const { auth } = this.assetServer;
    const plugins = [
      prebundleWorkspace(),
      precompress()
    ];

    return auth === undefined ? plugins : [...plugins, auth.plugin()];
  }
}
