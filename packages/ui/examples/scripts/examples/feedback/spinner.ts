// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import type { Spinner } from "../../../../src/index.ts";
import { button } from "../shared/containerBuilders.ts";

// CONSTANTS
const kSizes = [
  {
    label: "Inline",
    size: "1em"
  },
  {
    label: "Button",
    size: "14px"
  },
  {
    label: "Overlay",
    size: "28px"
  }
] as const;
const kBusyDurationMs = 2_000;

export const SPINNER_EXAMPLE: GalleryExample = {
  id: "feedback/spinner",
  title: "Spinner",
  group: "Feedback",
  render(host) {
    const root = document.createElement("div");
    root.className = "spinner-example";

    const states = document.createElement("section");
    states.className = "spinner-states";
    for (const { label, size } of kSizes) {
      states.append(state(label, size));
    }

    const scenario = document.createElement("section");
    scenario.className = "spinner-scenario";
    const status = document.createElement("p");
    status.className = "scenario-hint";
    status.textContent = "Idle.";

    const trigger = button("Load something", "accent");
    trigger.dataset.action = "start-busy";
    const busy = spinner("Loading something");
    busy.hidden = true;
    busy.dataset.role = "scenario-spinner";
    const row = document.createElement("div");
    row.className = "chrome-row";
    row.append(trigger, busy);

    let timer: number | undefined;

    function stop(): void {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    }

    trigger.addEventListener("click", () => {
      stop();
      busy.hidden = false;
      trigger.disabled = true;
      status.textContent = "Loading something...";
      timer = window.setTimeout(() => {
        timer = undefined;
        busy.hidden = true;
        trigger.disabled = false;
        status.textContent = "Done.";
      }, kBusyDurationMs);
    });

    scenario.append(status, row);
    root.append(states, scenario);
    host.append(root);

    return () => {
      stop();
      root.remove();
    };
  }
};

function state(
  label: string,
  size: string
): HTMLElement {
  const row = document.createElement("div");
  row.className = "spinner-state";
  const name = document.createElement("span");
  name.className = "state-name";
  name.textContent = label;
  const element = spinner(label);
  element.style.setProperty("--jolly-spinner-size", size);
  row.append(name, element);

  return row;
}

function spinner(
  label: string
): Spinner {
  const element = document.createElement("jolly-spinner");
  element.label = label;

  return element;
}
