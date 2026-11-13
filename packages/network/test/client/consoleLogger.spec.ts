// Import Node.js Dependencies
import { Console } from "node:console";
import { Writable } from "node:stream";
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { consoleLogger } from "#src/client/index.ts";

class TextSink extends Writable {
  text = "";

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: () => void
  ): void {
    this.text += chunk.toString();
    callback();
  }
}

test("consoleLogger writes every level to the console it is given", () => {
  const stdout = new TextSink();
  const stderr = new TextSink();
  const logger = consoleLogger(new Console({
    stdout,
    stderr
  }));

  logger.info("joined");
  logger.error("lost");

  assert.match(stdout.text, /joined/);
  assert.match(stderr.text, /lost/);
});
