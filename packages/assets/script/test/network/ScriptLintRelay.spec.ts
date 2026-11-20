// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import type { ScriptDiagnostic } from "@jolly-pixel/scripting";

// Import Internal Dependencies
import { ScriptLintFeed } from "#src/network/ScriptLintFeed.ts";
import { TextEdit } from "#src/model/TextEdit.ts";
import { ScriptSession } from "../helpers/ScriptSession.ts";

// CONSTANTS
const kDiagnostic: ScriptDiagnostic = {
  start: 4,
  length: 1,
  severity: "warning",
  message: "'a' is declared but never used.",
  code: "eslint(no-unused-vars)"
};

function lintSession(
  linted: string[]
): ScriptSession {
  return new ScriptSession("let a = 1;", {
    lint: (text) => {
      linted.push(text);

      return Promise.resolve([kDiagnostic]);
    }
  });
}

describe("script lint relay", () => {
  test("answers only the requesting peer and lints each text once", async() => {
    const linted: string[] = [];
    const session = lintSession(linted);
    const alice = await session.join("A");
    const bob = await session.join("B");
    const aliceFeed = new ScriptLintFeed(alice.room, () => alice.script.document.text);
    const bobFeed = new ScriptLintFeed(bob.room, () => bob.script.document.text);
    const aliceReports: (readonly ScriptDiagnostic[])[] = [];
    const bobReports: (readonly ScriptDiagnostic[])[] = [];
    aliceFeed.on("change", (diagnostics) => aliceReports.push(diagnostics));
    bobFeed.on("change", (diagnostics) => bobReports.push(diagnostics));

    aliceFeed.request();
    aliceFeed.request();
    await session.upload(alice);
    await setImmediate();
    session.deliver(alice);
    session.deliver(bob);

    assert.deepEqual(linted, ["let a = 1;"]);
    assert.deepEqual(aliceReports, [[kDiagnostic], [kDiagnostic]]);
    assert.deepEqual(bobReports, []);
  });

  test("drops the diagnostics of a text the peer has edited since", async() => {
    const session = lintSession([]);
    const alice = await session.join("A");
    const feed = new ScriptLintFeed(alice.room, () => alice.script.document.text);
    const reports: (readonly ScriptDiagnostic[])[] = [];
    feed.on("change", (diagnostics) => reports.push(diagnostics));

    feed.request();
    await session.upload(alice);
    alice.script.document.edit(TextEdit.insertion(0, "\n"));
    await setImmediate();
    session.deliver(alice);

    assert.deepEqual(reports, []);
  });

  test("runs one lint at a time and lints the newest text once the running one ends", async() => {
    const linted: string[] = [];
    const runs: PromiseWithResolvers<ScriptDiagnostic[]>[] = [];
    const session = new ScriptSession("let a = 1;", {
      lint: (text) => {
        linted.push(text);
        runs.push(Promise.withResolvers());

        return runs[runs.length - 1].promise;
      }
    });
    const alice = await session.join("A");
    const feed = new ScriptLintFeed(alice.room, () => alice.script.document.text);
    const reports: (readonly ScriptDiagnostic[])[] = [];
    feed.on("change", (diagnostics) => reports.push(diagnostics));

    feed.request();
    await session.upload(alice);
    alice.script.document.edit(TextEdit.insertion(0, "\n"));
    feed.request();
    await session.upload(alice);
    assert.deepEqual(linted, ["let a = 1;"]);

    runs[0].resolve([]);
    await setImmediate();
    assert.deepEqual(linted, ["let a = 1;", "\nlet a = 1;"]);

    runs[1].resolve([kDiagnostic]);
    await setImmediate();
    session.deliver(alice);
    assert.deepEqual(reports, [[kDiagnostic]]);
  });
});
