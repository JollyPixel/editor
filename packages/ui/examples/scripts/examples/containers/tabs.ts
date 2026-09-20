// Import Internal Dependencies
import {
  detailOf,
  type Tab,
  type Tabs
} from "../../../../src/index.ts";
import type { GalleryExample } from "../../types.ts";

type TabsOptionKey =
  | "skew"
  | "vertical"
  | "closable"
  | "badges"
  | "action"
  | "addButton";

interface TabsBooleanOption {
  key: TabsOptionKey;
  label: string;
}

interface SampleTab {
  value: string;
  badge: string;
  disabled?: boolean;
}

// CONSTANTS
const kOptions: TabsBooleanOption[] = [
  { key: "skew", label: "Skew variant" },
  { key: "vertical", label: "Vertical" },
  { key: "closable", label: "Closable" },
  { key: "badges", label: "Badges" },
  { key: "action", label: "Action" },
  { key: "addButton", label: "Add button" }
];
const kSampleTabs: SampleTab[] = [
  { value: "grass", badge: "12" },
  { value: "stone", badge: "3" },
  { value: "water", badge: "7" },
  { value: "lava", badge: "0", disabled: true }
];

function buildTab(
  sample: SampleTab
): Tab {
  const tab = document.createElement("jolly-tab");
  tab.value = sample.value;
  tab.label = sample.value;
  tab.disabled = sample.disabled ?? false;
  tab.dataset.badge = sample.badge;
  tab.textContent = `${sample.value} panel`;

  return tab;
}

function buildAddButton(
  tabs: Tabs,
  decorate: (tab: Tab) => void
): HTMLElement {
  let created = 0;
  const add = document.createElement("jolly-button");
  add.slot = "list-end";
  add.icon = "plus";
  add.iconOnly = true;
  add.label = "Add tab";
  add.addEventListener("click", () => {
    created += 1;
    const tab = buildTab({
      value: `texture-${created}`,
      badge: "0"
    });
    decorate(tab);
    tabs.value = tab.value;
    tabs.append(tab);
  });

  return add;
}

function buildTabs(
  options: Record<TabsOptionKey, boolean>
): { tabs: Tabs; apply: () => void; } {
  const tabs = document.createElement("jolly-tabs");
  tabs.id = "container-example-tabs";
  tabs.append(...kSampleTabs.map(buildTab));

  function decorate(
    tab: Tab
  ): void {
    tab.closable = options.closable;
    tab.badge = options.badges ? tab.dataset.badge ?? "" : "";
    tab.action = options.action ? "search" : "";
    tab.actionLabel = "Inspect";
  }

  const add = buildAddButton(tabs, decorate);

  function apply(): void {
    tabs.variant = options.skew ? "skew" : "default";
    tabs.orientation = options.vertical ? "vertical" : "horizontal";
    for (const tab of tabs.querySelectorAll("jolly-tab")) {
      decorate(tab);
    }
    if (options.addButton) {
      tabs.append(add);
    }
    else {
      add.remove();
    }
  }

  tabs.addEventListener("jolly-tab-close", (event) => {
    const closed = [...tabs.querySelectorAll("jolly-tab")].find(
      (tab) => tab.value === event.detail.value
    );
    closed?.remove();
  });
  tabs.addEventListener("jolly-tab-action", (event) => {
    tabs.dataset.action = event.detail.value;
  });
  apply();

  return { tabs, apply };
}

function buildOptionsPanel(
  options: Record<TabsOptionKey, boolean>,
  apply: () => void
): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "tabs-demo-options";

  const heading = document.createElement("h3");
  heading.textContent = "Options";
  panel.append(heading);

  for (const option of kOptions) {
    const checkbox = document.createElement("jolly-checkbox");
    checkbox.label = option.label;
    checkbox.clickableBackground = true;
    checkbox.align = "end";
    checkbox.value = options[option.key];
    checkbox.addEventListener("jolly-change", (event) => {
      const detail = detailOf<{ value: boolean; }>(event);
      if (detail !== null) {
        options[option.key] = detail.value;
        apply();
      }
    });
    panel.append(checkbox);
  }

  return panel;
}

export const TABS_EXAMPLE: GalleryExample = {
  id: "containers/tabs",
  title: "Tabs",
  render(host) {
    const options: Record<TabsOptionKey, boolean> = {
      skew: false,
      vertical: false,
      closable: false,
      badges: false,
      action: false,
      addButton: false
    };
    const root = document.createElement("div");
    root.className = "tabs-demo";

    const { tabs, apply } = buildTabs(options);
    root.append(tabs, buildOptionsPanel(options, apply));
    host.append(root);
  }
};
