// Import Node.js Dependencies
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface TempWorkspace extends AsyncDisposable {
  readonly root: string;
}

/**
 * Creates an isolated directory removed when the scope exits.
 */
export async function tempWorkspace(): Promise<TempWorkspace> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "jolly-asset-server-")
  );

  return {
    root,
    async [Symbol.asyncDispose]() {
      await fs.rm(root, { recursive: true, force: true });
    }
  };
}
