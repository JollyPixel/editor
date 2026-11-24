// Import Node.js Dependencies
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import type { Duplex } from "node:stream";

// Import Third-party Dependencies
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";

// Import Internal Dependencies
import { PROJECT_MANIFEST_FILE } from "#src/project/ProjectManifest.ts";

// CONSTANTS
export const SHELL_HTML = "<!DOCTYPE html><title>JollyPixel Studio</title>";
export const COMPILED_EDITOR_HTML = "<!DOCTYPE html><title>Compiled Voxel Map</title>";
export const PUBLIC_HOST = "studio.example.com";
const kVoxelMapKinds = "@jolly-pixel/asset.voxel-map";

export interface ShellPackageNames {
  editors: string[];
  kinds: string[];
}

export interface Upgrade {
  status: number | undefined;
  socket: Duplex | null;
}

export async function createShell(
  root: string
): Promise<string> {
  const shell = path.join(root, "shell");
  await fs.mkdir(path.join(shell, "editors", "voxel-map"), { recursive: true });
  await fs.writeFile(path.join(shell, "index.html"), SHELL_HTML);
  await fs.writeFile(
    path.join(shell, "editors", "voxel-map", "index.html"),
    COMPILED_EDITOR_HTML
  );
  await writeShellManifest(shell, {
    editors: ["voxel-map"],
    kinds: [kVoxelMapKinds]
  });

  return shell;
}

export async function writeShellManifest(
  shell: string,
  packages: ShellPackageNames
): Promise<void> {
  await fs.writeFile(
    path.join(shell, PROJECT_MANIFEST_FILE),
    JSON.stringify({
      editors: packages.editors.map((name) => {
        return {
          name,
          package: `@jolly-pixel/editor.${name}`,
          kinds: []
        };
      }),
      kinds: [],
      kindPackages: packages.kinds.map((name) => {
        return {
          name,
          kinds: [],
          configurable: false
        };
      }),
      maxContentBytes: 1
    })
  );
}

export function requestUpgrade(
  url: URL,
  host: string,
  pathname = DEFAULT_WEBSOCKET_PATH
): Promise<Upgrade> {
  const { promise, resolve, reject } = Promise.withResolvers<Upgrade>();
  const request = http.request(new URL(`.${pathname}`, url), {
    headers: {
      host,
      connection: "Upgrade",
      upgrade: "websocket",
      "sec-websocket-version": "13",
      "sec-websocket-key": randomBytes(16).toString("base64")
    }
  });
  request.once("upgrade", (response, socket) => {
    resolve({
      status: response.statusCode,
      socket
    });
  });
  request.once("response", (response) => {
    response.resume();
    resolve({
      status: response.statusCode,
      socket: null
    });
  });
  request.once("error", reject);
  request.end();

  return promise;
}
