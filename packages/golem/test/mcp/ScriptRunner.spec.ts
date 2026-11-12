// Import Node.js Dependencies
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ScriptRunner } from "#src/mcp/ScriptRunner.ts";

// CONSTANTS
const kScripts = {
  "env.mjs": [
    "console.log(JSON.stringify({",
    "  url: process.env.JOLLY_STUDIO_URL,",
    "  token: process.env.JOLLY_GOLEM_TOKEN,",
    "  cwd: process.cwd(),",
    "  args: process.argv.slice(2)",
    "}));",
    "process.exitCode = 3;"
  ].join("\n"),
  "forever.mjs": "setInterval(() => undefined, 1_000);"
};

describe("ScriptRunner", { timeout: 10_000 }, () => {
  let root: string;
  let scriptsDir: string;
  let runner: ScriptRunner;

  before(async() => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "golem-scripts-")));
    scriptsDir = path.join(root, "local");
    await fs.mkdir(scriptsDir);
    for (const [name, source] of Object.entries(kScripts)) {
      await fs.writeFile(path.join(scriptsDir, name), source);
    }
    await fs.writeFile(path.join(root, "outside.mjs"), "console.log(\"ran\");");
    runner = new ScriptRunner({
      target: {
        url: new URL("http://localhost:5173/"),
        token: "agent-token",
        timeoutMs: 1_000
      },
      scriptsDir,
      cwd: root
    });
  });

  after(async() => {
    for (const name of Object.keys(kScripts)) {
      await fs.unlink(path.join(scriptsDir, name));
    }
    await fs.unlink(path.join(root, "outside.mjs"));
    await fs.rmdir(scriptsDir);
    await fs.rmdir(root);
  });

  test("runs a script with the golem's studio and token, and answers its exit code and output", async() => {
    const run = await runner.run("env.mjs", { args: ["--size", "32"] });

    assert.equal(run.exitCode, 3);
    assert.equal(run.timedOut, false);
    assert.deepEqual(JSON.parse(run.stdout), {
      url: "http://localhost:5173/",
      token: "agent-token",
      cwd: root,
      args: ["--size", "32"]
    });
  });

  test("refuses a script outside its folder without running it", async() => {
    await assert.rejects(
      runner.run("../outside.mjs"),
      /is outside it/
    );
  });

  test("stops a script that runs past its timeout", async() => {
    const run = await runner.run("forever.mjs", { timeoutMs: 300 });

    assert.equal(run.timedOut, true);
    assert.equal(run.exitCode, null);
  });
});
