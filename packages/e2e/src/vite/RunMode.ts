// Import Third-party Dependencies
import type {
  ConfigEnv,
  PluginOption,
  ServerOptions
} from "vite";
import type { RightsMap } from "@jolly-pixel/network";

// Import Internal Dependencies
import { CookieRoles } from "../roles.ts";
import { prebundleWorkspace } from "./prebundleWorkspace.ts";

// CONSTANTS
const kE2EMode = "e2e";
const kDefaultRole = "member";
const kRights = {
  member: {
    "*": "write"
  },
  spectator: {
    "*.$join": "write",
    "*.$presence": "write",
    "*": "read"
  }
} as const satisfies RightsMap;

export interface RunModeOptions {
  port: number;
}

export interface RunModeAccess {
  auth: CookieRoles | undefined;
  rights: RightsMap;
  defaultRole: string;
}

export class RunMode {
  readonly serve: boolean;
  readonly e2e: boolean;
  readonly inMemory: boolean;
  readonly server: ServerOptions;
  readonly access: RunModeAccess;
  readonly #roles: CookieRoles | undefined;

  constructor(
    env: ConfigEnv,
    options: RunModeOptions
  ) {
    this.serve = env.command === "serve";
    this.e2e = env.mode === kE2EMode;
    this.inMemory = this.e2e || !this.serve;
    this.server = this.e2e ?
      {
        port: options.port,
        strictPort: true
      } :
      {
        allowedHosts: true
      };
    this.#roles = this.e2e ? new CookieRoles() : undefined;
    this.access = {
      auth: this.#roles,
      rights: kRights,
      defaultRole: kDefaultRole
    };
  }

  plugins(): PluginOption[] {
    return this.#roles === undefined ?
      [] :
      [prebundleWorkspace(), this.#roles.plugin()];
  }
}
