// Import Third-party Dependencies
import type {
  LaunchMessage,
  ShellMessage
} from "@jolly-pixel/editor.host";

export interface EditorFrameOptions {
  id: string;
  element: HTMLIFrameElement;
  reads: ReadonlySet<string>;
  origin: string;
}

export class EditorFrame {
  readonly id: string;
  readonly element: HTMLIFrameElement;
  readonly reads: ReadonlySet<string>;

  #origin: string;
  #stops: Array<() => void> | null = null;
  #unsentReveal: string | null = null;

  constructor(
    options: EditorFrameOptions
  ) {
    this.id = options.id;
    this.element = options.element;
    this.reads = options.reads;
    this.#origin = options.origin;
  }

  owns(
    source: MessageEventSource | null
  ): boolean {
    return source !== null && this.element.contentWindow === source;
  }

  launch(
    message: Omit<LaunchMessage, "reveal">,
    stops: Array<() => void>
  ): void {
    this.#stops = stops;
    const reveal = this.#unsentReveal;
    this.#unsentReveal = null;
    this.#send(
      {
        ...message,
        ...reveal === null ? {} : { reveal }
      },
      Object.values(message.ports).filter((port) => port !== undefined)
    );
  }

  reveal(
    key: string
  ): void {
    if (this.#stops === null) {
      this.#unsentReveal = key;
    }
    else {
      this.post({
        type: "jolly-reveal",
        key
      });
    }
  }

  post(
    message: ShellMessage
  ): void {
    this.#send(message, []);
  }

  closePorts(): void {
    for (const stop of this.#stops ?? []) {
      stop();
    }
    this.#stops = null;
  }

  dispose(): void {
    this.closePorts();
    this.element.remove();
  }

  #send(
    message: ShellMessage | LaunchMessage,
    transfer: Transferable[]
  ): void {
    this.element.contentWindow?.postMessage(message, this.#origin, transfer);
  }
}
