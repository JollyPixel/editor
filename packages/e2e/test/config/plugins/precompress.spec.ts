// Import Node.js Dependencies
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import {
  describe,
  it
} from "node:test";

// Import Third-party Dependencies
import { build } from "vite";

// Import Internal Dependencies
import { precompress } from "../../../src/config/plugins/precompress.ts";

// CONSTANTS
const kLongText = "voxel ".repeat(400);

interface BuiltFixture extends AsyncDisposable {
  outDir: string;
}

async function buildFixture(): Promise<BuiltFixture> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "jolly-e2e-precompress-")
  );
  await fs.writeFile(
    path.join(root, "index.html"),
    "<!doctype html><script type=\"module\" src=\"./main.js\"></script>"
  );
  await fs.writeFile(
    path.join(root, "main.js"),
    `document.body.textContent = ${JSON.stringify(kLongText)};`
  );
  await build({
    configFile: false,
    root,
    logLevel: "silent",
    plugins: [
      precompress()
    ]
  });

  return {
    outDir: path.join(root, "dist"),
    async [Symbol.asyncDispose]() {
      await fs.rm(root, { recursive: true, force: true });
    }
  };
}

describe("precompress", () => {
  it("writes brotli and gzip siblings that decode to each large built file", async() => {
    await using fixture = await buildFixture();
    const { outDir } = fixture;
    const assets = await fs.readdir(path.join(outDir, "assets"));
    const chunk = assets.find((name) => name.endsWith(".js"));
    assert.ok(chunk);

    const file = path.join(outDir, "assets", chunk);
    const content = await fs.readFile(file);

    assert.deepEqual(
      zlib.brotliDecompressSync(await fs.readFile(`${file}.br`)),
      content
    );
    assert.deepEqual(
      zlib.gunzipSync(await fs.readFile(`${file}.gz`)),
      content
    );
  });

  it("leaves files under one kilobyte uncompressed", async() => {
    await using fixture = await buildFixture();
    const { outDir } = fixture;
    const files = await fs.readdir(outDir);

    assert.ok(files.includes("index.html"));
    assert.equal(files.includes("index.html.br"), false);
    assert.equal(files.includes("index.html.gz"), false);
  });
});
