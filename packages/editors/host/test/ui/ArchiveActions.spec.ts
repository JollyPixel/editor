// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { ArchiveActions } from "#src/ui/index.ts";
import "#src/ui/index.ts";
import { EditorArchives } from "#src/session/EditorArchives.ts";
import type { SessionWorkspace } from "#src/workspace/SessionWorkspace.ts";

interface FakeArchivesOptions {
  canImport?: boolean;
  workspace?: SessionWorkspace | null;
  exportError?: Error;
}

function createArchives(
  options: FakeArchivesOptions = {}
): EditorArchives {
  const {
    canImport = true,
    workspace = null,
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
    workspace,
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

    assert.equal(query(element, "#reset-workspace"), null);
    assert.equal(query(element, "#import-archive")?.hasAttribute("disabled"), true);
    assert.equal(query(element, ".notice"), null);
  });

  test("shows the volatile notice without the reset button", async() => {
    const element = await mount(createArchives({
      workspace: {
        persistent: false,
        reset: () => Promise.resolve()
      }
    }));

    assert.equal(query(element, "#reset-workspace"), null);
    assert.ok(query(element, ".notice"));
  });

  test("offers reset for a persistent workspace", async() => {
    const element = await mount(createArchives({
      workspace: {
        persistent: true,
        reset: () => Promise.resolve()
      }
    }));

    assert.ok(query(element, "#reset-workspace"));
    assert.equal(query(element, ".notice"), null);
  });

  test("reports the error of a failed flow", async() => {
    const element = await mount(createArchives({
      exportError: new Error("export failed")
    }));

    query(element, "#export-archive")!.click();
    await new Promise((resolve) => {
      setTimeout(resolve);
    });
    await element.updateComplete;

    assert.equal(query(element, "[role=alert]")?.textContent, "export failed");
  });
});
