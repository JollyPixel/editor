// Import Internal Dependencies
import type {
  Tab,
  Tabs
} from "../../../../src/index.ts";
import type {
  GalleryExample,
  GalleryOptionValues
} from "../../types.ts";

type TabsOptionKey =
  | "skew"
  | "vertical"
  | "closable"
  | "badges"
  | "action"
  | "addButton"
  | "preselected";

interface SampleTab {
  value: string;
  badge: string;
  disabled?: boolean;
}

// CONSTANTS
const kPreselectedTab = "stone";
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
  decorate: (tab: Tab) => Tab
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
    tabs.value = tab.value;
    tabs.append(decorate(tab));
  });

  return add;
}

function buildTabs(
  options: GalleryOptionValues<TabsOptionKey>
): Tabs {
  const tabs = document.createElement("jolly-tabs");
  tabs.variant = options.skew ? "skew" : "default";
  tabs.orientation = options.vertical ? "vertical" : "horizontal";
  if (options.preselected) {
    tabs.value = kPreselectedTab;
  }

  function decorate(
    tab: Tab
  ): Tab {
    tab.closable = options.closable;
    tab.badge = options.badges ? tab.dataset.badge ?? "" : "";
    tab.action = options.action ? "search" : "";
    tab.actionLabel = "Inspect";

    return tab;
  }

  tabs.append(
    ...kSampleTabs.map((sample) => decorate(buildTab(sample)))
  );
  if (options.addButton) {
    tabs.append(buildAddButton(tabs, decorate));
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

  return tabs;
}

export const TABS_EXAMPLE: GalleryExample<TabsOptionKey> = {
  id: "containers/tabs",
  title: "Tabs",
  options: [
    {
      key: "skew",
      label: "Skew variant"
    },
    {
      key: "vertical",
      label: "Vertical"
    },
    {
      key: "closable",
      label: "Closable"
    },
    {
      key: "badges",
      label: "Badges"
    },
    {
      key: "action",
      label: "Action"
    },
    {
      key: "addButton",
      label: "Add button"
    },
    {
      key: "preselected",
      label: "Preselected value"
    }
  ],
  render(host, options) {
    host.append(buildTabs(options));
  }
};
