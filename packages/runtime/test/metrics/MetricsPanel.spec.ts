// Import Node.js Dependencies
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

// Import Third-party Dependencies
import { Window } from "happy-dom";
import type { FacadeContainer } from "@jolly-pixel/ui";
import type {
  MetricDefinition,
  StatsRecorder as StatsRecorderType
} from "@jolly-pixel/ui/stats";

// CONSTANTS
const kBrowserWindow = new Window();
const kRefreshInterval = 100;

let MetricsPanel: typeof import("../../src/metrics/MetricsPanel.ts").MetricsPanel;
let StatsRecorder: typeof StatsRecorderType;

before(async() => {
  installBrowserGlobals();

  ({ MetricsPanel } = await import("../../src/metrics/MetricsPanel.ts"));
  ({ StatsRecorder } = await import("@jolly-pixel/ui/stats"));
});

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

class FakeContainer {
  #rows = new Set<string>();

  get facade(): FacadeContainer {
    return this.#scope(null) as unknown as FacadeContainer;
  }

  rows(): string[] {
    return [...this.#rows];
  }

  #scope(
    title: string | null
  ) {
    return {
      addMonitor: (_target: object, key: string) => {
        const row = title === null ? key : `${title}/${key}`;
        this.#rows.add(row);

        return this.#item(() => this.#rows.delete(row));
      },
      addFolder: (options: { title: string; }) => {
        return {
          ...this.#scope(options.title),
          ...this.#item(() => this.#clearFolder(options.title))
        };
      }
    };
  }

  #item(
    remove: () => void
  ) {
    return {
      hidden: false,
      refresh: () => undefined,
      dispose: remove
    };
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

function installBrowserGlobals(): void {
  const globals: Record<string, unknown> = {
    window: kBrowserWindow,
    document: kBrowserWindow.document,
    customElements: kBrowserWindow.customElements
  };
  for (const name of Object.getOwnPropertyNames(kBrowserWindow)) {
    if (/^[A-Z]/.test(name) && !(name in globalThis)) {
      globals[name] = Reflect.get(kBrowserWindow, name);
    }
  }
  Object.assign(globalThis, globals);
}
