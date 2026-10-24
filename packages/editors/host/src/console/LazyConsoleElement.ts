// Import Third-party Dependencies
import {
  isToggleShortcut,
  type CommandConsole,
  type VariableScript
} from "@jolly-pixel/console";

type ConsoleElement = HTMLElementTagNameMap["jolly-console"];

export class LazyConsoleElement {
  readonly #commands: CommandConsole;
  readonly #parent: HTMLElement;
  readonly #warn: (message: string) => void;
  readonly #triggers = new AbortController();
  readonly #unsubscribe: Array<() => void>;
  #loading: Promise<ConsoleElement | null> | null = null;
  #element: ConsoleElement | null = null;
  #disposed = false;

  constructor(
    commands: CommandConsole,
    parent: HTMLElement,
    warn: (message: string) => void
  ) {
    this.#commands = commands;
    this.#parent = parent;
    this.#warn = warn;
    parent.ownerDocument.defaultView?.addEventListener(
      "keydown",
      this.#onKeyDown,
      {
        capture: true,
        signal: this.#triggers.signal
      }
    );
    this.#unsubscribe = [
      commands.subscribe("open-requested", () => void this.#open()),
      commands.subscribe("script-requested", (script) => void this.#edit(script))
    ];
  }

  toggle(): void {
    if (this.#element === null) {
      void this.#open();
    }
    else {
      this.#element.toggle();
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.#detachTriggers();
    this.#element?.remove();
    this.#element = null;
  }

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (isToggleShortcut(event)) {
      event.preventDefault();
      void this.#open();
    }
  };

  async #open(): Promise<void> {
    const element = await this.#mount();
    await element?.show();
  }

  async #edit(
    script: VariableScript
  ): Promise<void> {
    const element = await this.#mount();
    await element?.editScript(script);
  }

  #mount(): Promise<ConsoleElement | null> {
    this.#loading ??= this.#create().catch((error: unknown) => {
      this.#loading = null;
      this.#warn(
        `The console failed to load: ${error instanceof Error ? error.message : String(error)}`
      );

      return null;
    });

    return this.#loading;
  }

  async #create(): Promise<ConsoleElement | null> {
    await import("@jolly-pixel/console/element");
    if (this.#disposed) {
      return null;
    }

    this.#detachTriggers();
    const element = this.#parent.ownerDocument.createElement("jolly-console");
    element.console = this.#commands;
    this.#parent.append(element);
    this.#element = element;

    return element;
  }

  #detachTriggers(): void {
    this.#triggers.abort();
    for (const unsubscribe of this.#unsubscribe.splice(0)) {
      unsubscribe();
    }
  }
}
