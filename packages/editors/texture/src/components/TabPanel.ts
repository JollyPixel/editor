export interface TabPanelOptions {
  id: string;
  label: string;
  icon?: string;
  mode?: string;
}

export class TabPanel {
  private id: string;
  private label: string;
  private icon: string;
  private mode?: string;
  private button: HTMLElement;
  private panel: HTMLElement;
  private onTabChange: ((id: string, mode?: string) => void) | null = null;

  constructor(options: TabPanelOptions) {
    this.id = options.id;
    this.label = options.label;
    this.icon = options.icon || "";
    this.mode = options.mode;

    this.button = this.createButton();
    this.panel = this.getPanel();
  }

  private createButton(): HTMLElement {
    const button = document.createElement("button");
    button.className = "tab-button";
    button.dataset.target = this.id;
    if (this.mode) {
      button.dataset.mode = this.mode;
    }
    button.textContent = `${this.icon} ${this.label}`;
    button.addEventListener("click", () => this.activate());

    return button;
  }

  private getPanel(): HTMLElement {
    const panel = document.getElementById(this.id) as HTMLElement;
    if (!panel) {
      throw new Error(`Panel with id "${this.id}" not found in DOM`);
    }

    return panel;
  }

  public activate(): void {
    // Show this panel
    this.panel.style.display = "";
    this.button.classList.add("active");

    // Hide other panels and deactivate buttons
    document.querySelectorAll<HTMLElement>(".tab-panel").forEach((p) => {
      if (p.id !== this.id) {
        p.style.display = "none";
      }
    });
    document.querySelectorAll<HTMLElement>(".tab-button").forEach((b) => {
      b.classList.toggle("active", (b as HTMLElement).dataset.target === this.id);
    });

    // Call the callback
    if (this.onTabChange) {
      this.onTabChange(this.id, this.mode);
    }
  }

  public setOnTabChange(callback: (id: string, mode?: string) => void): void {
    this.onTabChange = callback;
  }

  public getButton(): HTMLElement {
    return this.button;
  }

  public getId(): string {
    return this.id;
  }

  public getMode(): string | undefined {
    return this.mode;
  }
}
