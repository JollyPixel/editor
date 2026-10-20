// Import Node.js Dependencies
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface TempDirectory extends AsyncDisposable {
  readonly root: string;
}

export async function tempDirectory(): Promise<TempDirectory> {
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
