// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

// Import Internal Dependencies
import type { ArchiveActions } from "#src/ui/index.ts";
import "#src/ui/index.ts";
import { EditorArchives } from "#src/session/EditorArchives.ts";
import type { OfflineMode } from "#src/session/OfflineMode.ts";

interface FakeArchivesOptions {
  canImport?: boolean;
  offline?: OfflineMode | null;
  exportError?: Error;
}

function createArchives(
  options: FakeArchivesOptions = {}
): EditorArchives {
  const {
    canImport = true,
    offline = null,
    exportError
  } = options;

  return new EditorArchives({
    archive: {
      canImport,
      export: () => (exportError ?
        Promise.reject(exportError) :
        Promise.resolve(new Blob())),
      plan: () => Promise.reject(new Error("unused")),
      import: () => Promise.reject(new Error("unused"))
    },
    offline,
    accepts: "voxelmodel",
    fallbackName: "model",
    resetWarning: "",
    target: () => {
      return {
        id: "model-1",
        source: "model.json"
      };
    }
  });
}

async function mount(
  archives: EditorArchives | null
): Promise<ArchiveActions> {
  const element = document.createElement("jolly-archive-actions");
  element.archives = archives;
  document.body.append(element);
  await element.updateComplete;

  return element;
}

function query(
  element: ArchiveActions,
  selector: string
): HTMLElement | null {
  return element.shadowRoot!.querySelector(selector);
}

describe("ArchiveActions", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("renders nothing without archives", async() => {
    const element = await mount(null);

    assert.equal(query(element, "#export-archive"), null);
  });

  test("offers reset and import only when the archives allow them", async() => {
    const element = await mount(createArchives({ canImport: false }));

    assert.equal(query(element, "#reset-offline"), null);
    assert.equal(query(element, "#import-archive")?.hasAttribute("disabled"), true);
    assert.equal(query(element, ".notice"), null);
  });

  test("marks import as a destructive action", async() => {
    const element = await mount(createArchives());

    assert.equal(query(element, "#import-archive")?.getAttribute("variant"), "danger");
  });

  test("shows the volatile notice without the reset button", async() => {
    const element = await mount(createArchives({
      offline: {
        persistent: false,
        reset: () => Promise.resolve()
      }
    }));

    assert.equal(query(element, "#reset-offline"), null);
    assert.ok(query(element, ".notice"));
  });

  test("offers reset for persistent offline data", async() => {
    const element = await mount(createArchives({
      offline: {
        persistent: true,
        reset: () => Promise.resolve()
      }
    }));

    assert.ok(query(element, "#reset-offline"));
    assert.equal(query(element, ".notice"), null);
  });

  test("reports the error of a failed flow", async() => {
    const element = await mount(createArchives({
      exportError: new Error("export failed")
    }));

    query(element, "#export-archive")!.click();
    await setTimeout();
    await element.updateComplete;

    assert.equal(query(element, "[role=alert]")?.textContent, "export failed");
  });
});
