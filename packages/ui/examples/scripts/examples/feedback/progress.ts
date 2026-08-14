// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  Loading,
  Progress
} from "../../../../src/index.ts";
import { button } from "../shared/containerBuilders.ts";

// CONSTANTS
const kAssetTotal = 120;
const kEmptyPreviewDurationMs = 1_600;
const kAssetNames = [
  "textures/world-atlas.png",
  "models/player.glb",
  "audio/ambient-forest.ogg",
  "scenes/overworld/terrain.chunk.json",
  "scripts/gameplay/quest-controller.js"
] as const;

export const PROGRESS_EXAMPLE: GalleryExample = {
  id: "feedback/progress",
  title: "Progress and loading",
  group: "Feedback",
  render(host) {
    const root = document.createElement("div");
    root.className = "progress-example";

    const states = document.createElement("section");
    states.className = "progress-states";
    states.append(
      state("Empty", 0),
      state("Quarter", 25),
      state("Busy", null),
      state("Almost done", 84),
      state("Complete", 100)
    );

    const simulator = document.createElement("section");
    simulator.className = "progress-simulator";
    const status = document.createElement("p");
    status.className = "scenario-hint";
    status.textContent = "Ready to load 120 assets.";
    const aggregate = progress(0, "Aggregate asset progress");
    aggregate.max = kAssetTotal;
    const controls = document.createElement("div");
    controls.className = "chrome-row";
    const start = button("Load 120 assets", "accent");
    start.dataset.action = "start-loading";
    const reset = button("Reset");
    reset.dataset.action = "reset-loading";
    const fail = button("Simulate failure", "danger");
    fail.dataset.action = "fail-loading";
    const empty = button("Complete empty load");
    empty.dataset.action = "empty-loading";
    controls.append(start, reset, fail, empty);

    const preview = document.createElement("div");
    preview.className = "loading-preview";
    let loading = createLoading(preview);
    let completed = 0;
    let timer: number | undefined;
    let emptyTimer: number | undefined;

    function stop(): void {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
      if (emptyTimer !== undefined) {
        window.clearTimeout(emptyTimer);
        emptyTimer = undefined;
      }
    }

    function restore(): void {
      stop();
      completed = 0;
      aggregate.value = 0;
      status.textContent = "Ready to load 120 assets.";
      loading.remove();
      loading = createLoading(preview);
    }

    start.addEventListener("click", () => {
      restore();
      void loading.start();
      timer = window.setInterval(() => {
        const step = ((completed * 17) % 5) + 1;
        completed = Math.min(kAssetTotal, completed + step);
        const assetName = kAssetNames[completed % kAssetNames.length];
        aggregate.value = completed;
        aggregate.valueText = `${completed} of ${kAssetTotal} assets`;
        loading.setAsset(assetName);
        loading.setProgress(completed, kAssetTotal);
        status.textContent = `${completed} / ${kAssetTotal}: ${assetName}`;

        if (completed === kAssetTotal) {
          stop();
          status.textContent = "All 120 assets loaded.";
          void loading.complete();
        }
      }, 45);
    });
    reset.addEventListener("click", restore);
    fail.addEventListener("click", () => {
      stop();
      loading.error(new Error(
        "Unable to decode textures/world-atlas.png",
        {
          cause: new Error("Unsupported texture encoding")
        }
      ));
      status.textContent = "Loading stopped with a fatal error.";
    });
    empty.addEventListener("click", () => {
      restore();
      void loading.start();
      loading.setProgress(0, 0);
      status.textContent = "Empty load detected. Completion follows after the preview.";
      emptyTimer = window.setTimeout(() => {
        emptyTimer = undefined;
        status.textContent = "Empty load complete.";
        void loading.complete();
      }, kEmptyPreviewDurationMs);
    });

    simulator.append(status, aggregate, controls, preview);
    root.append(states, simulator);
    host.append(root);

    return () => {
      stop();
      root.remove();
    };
  }
};

function state(
  label: string,
  value: number | null
): HTMLElement {
  const row = document.createElement("div");
  row.className = "progress-state";
  const name = document.createElement("span");
  name.className = "state-name";
  name.textContent = label;
  row.append(name, progress(value, label));

  return row;
}

function progress(
  value: number | null,
  label: string
): Progress {
  const element = document.createElement("jolly-progress");
  element.value = value;
  element.max = 100;
  element.label = label;
  element.animated = value === null;
  element.completed = value === 100;

  return element;
}

function createLoading(
  preview: HTMLElement
): Loading {
  const element = document.createElement("jolly-loading");
  preview.append(element);

  return element;
}
