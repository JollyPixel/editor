// Import Node.js Dependencies
import assert from "node:assert/strict";
import test from "node:test";

// Import Internal Dependencies
import { DocumentTheme } from "../../src/theme/DocumentTheme.ts";
import {
  clearTheme,
  nextFrame,
  pickTheme
} from "../helpers/theme/scope.ts";

test("DocumentTheme follows each new page theme until stopped, then the system scheme", async() => {
  const scope = document.createElement("jolly-scope");
  pickTheme(scope, "dark");
  document.body.append(scope);
  const theme = new DocumentTheme();
  const received: Array<string> = [];

  const stop = theme.follow((mode) => received.push(mode));
  assert.equal(theme.mode, "dark");

  pickTheme(scope, "dark");
  await nextFrame();
  clearTheme(scope);
  await nextFrame();
  stop();
  pickTheme(scope, "dark");
  await nextFrame();

  assert.deepEqual(received, ["light"]);
  assert.equal(theme.mode, "dark");

  scope.remove();
});
