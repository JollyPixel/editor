// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { nothing } from "lit";

// Import Internal Dependencies
import {
  LazyTemplate,
  type LazyTemplateHost
} from "../../src/reactive/LazyTemplate.ts";

interface RecordingHost extends LazyTemplateHost {
  readonly renderRoot: HTMLElement;
  updates: number;
}

function recordingHost(): RecordingHost {
  return {
    renderRoot: document.createElement("div"),
    updates: 0,
    addController() {
      return undefined;
    },
    removeController() {
      return undefined;
    },
    requestUpdate() {
      this.updates++;
    },
    get updateComplete() {
      return Promise.resolve(true);
    }
  };
}

describe("LazyTemplate", () => {
  test("renders nothing until its module is ready", async() => {
    const host = recordingHost();
    const lazy = new LazyTemplate(host, () => Promise.resolve());

    assert.equal(lazy.render(() => "dialog"), nothing);

    await lazy.ready();

    assert.equal(lazy.render(() => "dialog"), "dialog");
    assert.equal(host.updates, 1);
  });

  test("loads its module once across concurrent ready calls", async() => {
    let loads = 0;
    const lazy = new LazyTemplate(recordingHost(), () => {
      loads++;

      return Promise.resolve();
    });

    await Promise.all([lazy.ready(), lazy.ready()]);
    await lazy.ready();

    assert.equal(loads, 1);
  });

  test("retries a module that failed to load", async() => {
    let loads = 0;
    const lazy = new LazyTemplate(recordingHost(), () => {
      loads++;

      return loads === 1 ?
        Promise.reject(new Error("offline")) :
        Promise.resolve();
    });

    await assert.rejects(lazy.ready(), /offline/);
    assert.equal(lazy.render(() => "dialog"), nothing);
    await lazy.ready();

    assert.equal(lazy.render(() => "dialog"), "dialog");
    assert.equal(loads, 2);
  });

  test("queries an element of the template once it is rendered", async() => {
    const host = recordingHost();
    const dialog = document.createElement("dialog");
    host.requestUpdate = () => {
      host.renderRoot.append(dialog);
    };
    const lazy = new LazyTemplate(host, () => Promise.resolve());

    assert.equal(await lazy.query("dialog"), dialog);
  });

  test("rejects a query for an element the template did not render", async() => {
    const lazy = new LazyTemplate(recordingHost(), () => Promise.resolve());

    await assert.rejects(lazy.query("dialog"), /<dialog> is not rendered/);
  });
});
