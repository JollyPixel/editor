// Import Third-party Dependencies
import {
  ConsoleMirror,
  type CommandConsole
} from "@jolly-pixel/console";

// Import Internal Dependencies
import {
  readDebugLogger,
  type HostLogger
} from "../debug/readDebugLogger.ts";

export interface FrameConsolesOptions {
  commands: CommandConsole;
  /**
   * @default readDebugLogger()
   */
  logger?: HostLogger;
}

export class FrameConsoles {
  #commands: CommandConsole;
  #logger: HostLogger;
  #mirrors = new Map<string, ConsoleMirror>();
  #focused: string | null = null;

  constructor(
    options: FrameConsolesOptions
  ) {
    this.#commands = options.commands;
    this.#logger = (options.logger ?? readDebugLogger()).child({
      namespace: "host.console"
    });
  }

  connect(
    id: string,
    port: MessagePort
  ): () => void {
    this.#mirrors.get(id)?.close();
    const mirror = new ConsoleMirror(port, this.#commands, {
      onConflict: (namespace) => this.#logger.warn(
        "editor namespace hidden by the shell",
        {
          frame: id,
          namespace
        }
      )
    });
    this.#mirrors.set(id, mirror);
    mirror.active = this.#focused === id;

    return () => {
      if (this.#mirrors.get(id) === mirror) {
        this.#mirrors.delete(id);
      }
      mirror.close();
    };
  }

  focus(
    id: string | null
  ): void {
    if (this.#focused === id) {
      return;
    }

    this.#activate(this.#focused, false);
    this.#focused = id;
    this.#activate(id, true);
  }

  #activate(
    id: string | null,
    active: boolean
  ): void {
    const mirror = id === null ? undefined : this.#mirrors.get(id);
    if (mirror !== undefined) {
      mirror.active = active;
    }
  }
}
