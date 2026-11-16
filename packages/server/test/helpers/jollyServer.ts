// Import Node.js Dependencies
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import type { Duplex } from "node:stream";

// Import Third-party Dependencies
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";

// CONSTANTS
export const SHELL_HTML = "<!DOCTYPE html><title>JollyPixel Studio</title>";
export const COMPILED_EDITOR_HTML = "<!DOCTYPE html><title>Compiled Voxel Map</title>";
export const PUBLIC_HOST = "studio.example.com";

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

  return shell;
}

export function requestUpgrade(
  url: URL,
  host: string
): Promise<Upgrade> {
  const { promise, resolve, reject } = Promise.withResolvers<Upgrade>();
  const request = http.request(new URL(`.${DEFAULT_WEBSOCKET_PATH}`, url), {
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
