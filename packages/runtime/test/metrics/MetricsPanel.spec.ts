// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type { FacadeContainer } from "@jolly-pixel/ui";
import {
  StatsRecorder,
  type MetricDefinition
} from "@jolly-pixel/ui/stats";

// Import Internal Dependencies
import {
  MetricsPanel,
  type MetricsPanelKeyboard
} from "../../src/metrics/MetricsPanel.ts";

// CONSTANTS
const kRefreshInterval = 100;

describe("MetricsPanel", () => {
  it("shows every metric without a filter", () => {
    const { recorder } = createRecorder();
    recorder.addMetric(voxelMetric("chunks"));
    const target = new FakeContainer();

    const panel = new MetricsPanel(recorder, {
      target: target.facade
    });

    assert.deepEqual(target.rows(), [
      "fps",
      "ms",
      "worstMs",
      "voxel/chunks"
    ]);
    panel.dispose();
  });

  it("leaves out the metrics the filter rejects", () => {
    const { recorder } = createRecorder();
    recorder.addMetric(voxelMetric("chunks"));
    const target = new FakeContainer();

    const panel = new MetricsPanel(recorder, {
      target: target.facade,
      filter: (metric) => metric.tile === false
    });

    assert.deepEqual(target.rows(), ["voxel/chunks"]);
    panel.dispose();
  });

  it("filters metrics registered after mounting", () => {
    const { recorder, advance } = createRecorder();
    const target = new FakeContainer();
    const panel = new MetricsPanel(recorder, {
      target: target.facade,
      filter: (metric) => metric.tile === false
    });

    recorder.addMetric(voxelMetric("meshes"));
    advance();

    assert.deepEqual(target.rows(), ["voxel/meshes"]);
    panel.dispose();
  });

  it("hides every row of a container it does not own, including later rows", () => {
    const { recorder, advance } = createRecorder();
    recorder.addMetric(voxelMetric("chunks"));
    const target = new FakeContainer();
    const panel = new MetricsPanel(recorder, {
      target: target.facade,
      hidden: true
    });
    assert.deepEqual(target.hiddenStates(), [true, true, true, true]);

    recorder.addMetric({
      id: "meshes",
      label: "meshes",
      group: "gpu"
    });
    advance();
    assert.equal(panel.hidden, true);
    assert.deepEqual(target.hiddenStates(), [true, true, true, true, true]);

    panel.hidden = false;
    assert.deepEqual(target.hiddenStates(), [false, false, false, false, false]);
    panel.dispose();
  });

  it("toggles its own pane with the key and ignores repeats", () => {
    const { recorder } = createRecorder();
    const element = document.createElement("div");
    const keyboard = new FakeKeyboard();
    const panel = new MetricsPanel(recorder, {
      target: element,
      keyboard,
      toggleKey: "F3"
    });
    const pane = element.firstElementChild;
    assert.ok(pane instanceof HTMLElement);
    assert.equal(pane.hidden, false);

    keyboard.press("F3");
    assert.equal(panel.hidden, true);
    assert.equal(pane.hidden, true);

    keyboard.press("F3", true);
    assert.equal(pane.hidden, true);

    keyboard.press("F3");
    assert.equal(pane.hidden, false);
    panel.dispose();
  });

  it("dispose releases the key, the recorder and its rows", () => {
    const { recorder, advance } = createRecorder();
    const target = new FakeContainer();
    const keyboard = new FakeKeyboard();
    const panel = new MetricsPanel(recorder, {
      target: target.facade,
      keyboard,
      toggleKey: "F3"
    });

    panel.dispose();
    recorder.addMetric(voxelMetric("chunks"));
    advance();

    assert.deepEqual(target.rows(), []);
    assert.equal(keyboard.listenerCount("F3"), 0);
  });

  it("dispose removes its own pane", () => {
    const { recorder } = createRecorder();
    const element = document.createElement("div");
    const panel = new MetricsPanel(recorder, {
      target: element
    });

    panel.dispose();

    assert.equal(element.childElementCount, 0);
  });
});

function voxelMetric(
  id: string
): MetricDefinition {
  return {
    id,
    label: id,
    group: "voxel",
    tile: false
  };
}

function createRecorder() {
  let now = 0;
  const recorder = new StatsRecorder({
    refreshInterval: kRefreshInterval,
    performance: {
      now: () => now
    }
  });

  return {
    recorder,
    advance() {
      recorder.begin();
      now += kRefreshInterval;
      recorder.end();
    }
  };
}

type KeyHandler = (event: KeyboardEvent) => void;

class FakeKeyboard implements MetricsPanelKeyboard {
  #handlers = new Map<string, Set<KeyHandler>>();

  on(
    type: string,
    handler: KeyHandler
  ): void {
    const handlers = this.#handlers.get(type) ?? new Set();
    handlers.add(handler);
    this.#handlers.set(type, handlers);
  }

  off(
    type: string,
    handler: KeyHandler
  ): void {
    this.#handlers.get(type)?.delete(handler);
  }

  press(
    code: string,
    repeat = false
  ): void {
    const event = new KeyboardEvent("keydown", {
      code,
      repeat
    });
    for (const handler of this.#handlers.get(code) ?? []) {
      handler(event);
    }
  }

  listenerCount(
    code: string
  ): number {
    return this.#handlers.get(code)?.size ?? 0;
  }
}

interface FakeItem {
  hidden: boolean;
  refresh(): void;
  dispose(): void;
}

class FakeContainer {
  #rows = new Set<string>();
  #items = new Set<FakeItem>();

  get facade(): FacadeContainer {
    return this.#scope(null) as unknown as FacadeContainer;
  }

  rows(): string[] {
    return [...this.#rows];
  }

  hiddenStates(): boolean[] {
    return [...this.#items].map((item) => item.hidden);
  }

  #scope(
    title: string | null
  ) {
    return {
      addMonitor: (_target: object, key: string) => {
        const row = title === null ? key : `${title}/${key}`;
        this.#rows.add(row);

        return this.#item(
          {},
          () => this.#rows.delete(row),
          title === null
        );
      },
      addFolder: (options: { title: string; }) => this.#item(
        this.#scope(options.title),
        () => this.#clearFolder(options.title),
        true
      )
    };
  }

  #item<TTarget extends object>(
    target: TTarget,
    remove: () => void,
    tracked: boolean
  ): TTarget & FakeItem {
    const item = Object.assign(target, {
      hidden: false,
      refresh: () => undefined,
      dispose: () => {
        remove();
        this.#items.delete(item);
      }
    });
    if (tracked) {
      this.#items.add(item);
    }

    return item;
  }

  #clearFolder(
    title: string
  ): void {
    for (const row of this.#rows) {
      if (row.startsWith(`${title}/`)) {
        this.#rows.delete(row);
      }
    }
  }
}
