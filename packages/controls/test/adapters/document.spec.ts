// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { BrowserDocumentAdapter } from "../../src/adapters/index.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();
const kEmulatedDocument = kEmulatedBrowserWindow.document as unknown as Document;
const kOriginalDocument = globalThis.document;

describe("Controls.Adapters.BrowserDocumentAdapter", () => {
  let adapter: BrowserDocumentAdapter;

  beforeEach(() => {
    globalThis.document = kEmulatedDocument;
    adapter = new BrowserDocumentAdapter();
  });

  afterEach(() => {
    globalThis.document = kOriginalDocument;
  });

  test("should read fullscreenElement from the real document rather than an unset own property", () => {
    assert.strictEqual(
      adapter.fullscreenElement,
      kEmulatedDocument.fullscreenElement
    );
  });

  test("should read pointerLockElement from the real document rather than an unset own property", () => {
    assert.strictEqual(
      adapter.pointerLockElement,
      kEmulatedDocument.pointerLockElement
    );
  });
});
