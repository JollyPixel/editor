// Import Internal Dependencies
import { TabPanel, TabPanelOptions } from "./TabPanel.ts";

export type TabChangeCallback = (tabId: string, mode?: string) => void;

export class TabManager {
  private tabs: Map<string, TabPanel> = new Map();
  private tabsContainer: HTMLElement;
  private onTabChange: TabChangeCallback | null = null;

  constructor(tabsContainerId: string) {
    this.tabsContainer = document.querySelector(tabsContainerId) as HTMLElement;
    if (!this.tabsContainer) {
      throw new Error(`Tabs container with selector "${tabsContainerId}" not found in DOM`);
    }
  }

  public addTab(options: TabPanelOptions): TabPanel {
    const tab = new TabPanel(options);
    this.tabs.set(options.id, tab);

    tab.setOnTabChange((id, mode) => {
      if (this.onTabChange) {
        this.onTabChange(id, mode);
      }
    });

    this.tabsContainer.appendChild(tab.getButton());

    return tab;
  }

  public getTab(id: string): TabPanel | undefined {
    return this.tabs.get(id);
  }

  public setOnTabChange(callback: TabChangeCallback): void {
    this.onTabChange = callback;
  }

  public activateTab(id: string): void {
    const tab = this.tabs.get(id);
    if (tab) {
      tab.activate();
    }
  }

  public getAllTabs(): TabPanel[] {
    return Array.from(this.tabs.values());
  }
}
