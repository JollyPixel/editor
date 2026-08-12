// Import Node.js Dependencies
import assert from "node:assert/strict";
import test from "node:test";

// Import Internal Dependencies
import {
  ensureDocumentStyles
} from "../../src/interaction/ensureDocumentStyles.ts";

test("ensureDocumentStyles installs each document style once", () => {
  const id = "jolly-test-document-styles";
  document.getElementById(id)?.remove();

  ensureDocumentStyles(id, ".first { color: red; }");
  ensureDocumentStyles(id, ".second { color: blue; }");

  const styles = document.querySelectorAll(`#${id}`);
  assert.equal(styles.length, 1);
  assert.equal(styles[0]?.textContent, ".first { color: red; }");

  styles[0]?.remove();
});

test("ensureDocumentStyles is safe without a document", () => {
  assert.doesNotThrow(() => {
    ensureDocumentStyles("jolly-no-document", "", undefined);
  });
});
