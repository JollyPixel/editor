// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  rmdirSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Import Internal Dependencies
import type { CallFrame } from "../../src/analysis/CallFrame.ts";
import { SourceMapFile } from "../../src/analysis/SourceMapFile.ts";

// CONSTANTS
const kCode = "abcdefg\nhij";
const kSourceMap = {
  version: 3,
  sources: ["a.ts", "b.ts"],
  names: [],
  mappings: "AAAA,GCAA,C;AAEA"
};

describe("SourceMapFile", () => {
  let dir: string;
  let bundle: string;

  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), "cdp-source-map-"));
    bundle = path.join(dir, "bundle.js");
    writeFileSync(`${bundle}.map`, JSON.stringify(kSourceMap));
  });

  after(() => {
    rmSync(`${bundle}.map`);
    rmdirSync(dir);
  });

  test("returns null when the file has no map next to it", () => {
    assert.equal(SourceMapFile.load(path.join(dir, "missing.js")), null);
  });

  test("maps a call frame's 0-based line to its 1-based original line", () => {
    const map = SourceMapFile.load(bundle);

    assert.deepEqual(map?.originalPosition(frameAt(1)), {
      source: source("b.ts"),
      line: 3,
      name: null
    });
  });

  test("returns null for a call frame without a line", () => {
    const map = SourceMapFile.load(bundle);

    assert.equal(map?.originalPosition(frameAt(-1)), null);
  });

  test("splits generated code into byte spans per source", () => {
    const map = SourceMapFile.load(bundle);

    assert.deepEqual(Array.from(map?.generatedSpans(kCode) ?? []), [
      { source: source("a.ts"), bytes: 3 },
      { source: source("b.ts"), bytes: 1 },
      { source: null, bytes: 3 },
      { source: source("b.ts"), bytes: 3 }
    ]);
  });

  function source(
    name: string
  ): string {
    return new URL(name, pathToFileURL(`${bundle}.map`)).href;
  }

  function frameAt(
    lineNumber: number
  ): CallFrame {
    return {
      functionName: "",
      url: pathToFileURL(bundle).href,
      lineNumber,
      columnNumber: 0
    };
  }
});
